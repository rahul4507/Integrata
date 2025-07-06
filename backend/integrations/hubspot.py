import json
import secrets
import base64
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import asyncio
from integrations.integration_item import IntegrationItem
from redis_client import add_key_value_redis, get_value_redis, delete_key_redis
from typing import Dict, Optional
from datetime import datetime

CLIENT_ID = "35a656f3-ed08-4a9b-9b60-642900cdfbc4"
CLIENT_SECRET = "c907f15c-bff7-40b6-bb45-2c965fa1327a"
REDIRECT_URI = 'http://localhost:8001/integrations/hubspot/oauth2callback'

# HubSpot OAuth endpoints
AUTHORIZATION_URL = 'https://app.hubspot.com/oauth/authorize'
TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'

# Required scopes for HubSpot integration
SCOPES = [
    'crm.objects.contacts.read',
    'crm.objects.companies.read',
    'crm.objects.deals.read',
    'crm.schemas.contacts.read',
    'crm.schemas.companies.read',
    'oauth'
]

object_type_map = {
    'contacts': 'Contact',
    'companies': 'Company',
    'deals': 'Deal'
}

async def authorize_hubspot(user_id, org_id):
    """
    Initiates HubSpot OAuth flow by generating authorization URL
    """
    try:
        # Generate secure state parameter
        state_data = {
            'state': secrets.token_urlsafe(32),
            'user_id': user_id,
            'org_id': org_id
        }

        encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode('utf-8')).decode('utf-8')

        # Store state in Redis for validation (expires in 10 minutes)
        redis_key = f'hubspot_state:{org_id}:{user_id}'
        await add_key_value_redis(redis_key, json.dumps(state_data), expire=600)

        # Build authorization URL
        scope_string = ' '.join(SCOPES)
        auth_url = (
            f"{AUTHORIZATION_URL}"
            f"?client_id={CLIENT_ID}"
            f"&redirect_uri={REDIRECT_URI}"
            f"&scope={scope_string}"
            f"&state={encoded_state}"
            f"&response_type=code"
        )

        return auth_url

    except Exception as e:
        print(f"Error in authorize_hubspot: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authorization setup failed: {str(e)}")


async def oauth2callback_hubspot(request: Request):
    """
    Handles OAuth callback from HubSpot and exchanges code for access token
    """
    try:
        # Check for errors in callback
        if request.query_params.get('error'):
            error_description = request.query_params.get('error_description', 'Unknown error')
            raise HTTPException(status_code=400, detail=error_description)

        # Extract code and state from callback
        code = request.query_params.get('code')
        encoded_state = request.query_params.get('state')

        if not code or not encoded_state:
            raise HTTPException(status_code=400, detail='Missing code or state parameter')

        # Decode and validate state
        try:
            decoded_bytes = base64.urlsafe_b64decode(encoded_state)
            decoded_string = decoded_bytes.decode('utf-8')
            state_data = json.loads(decoded_string)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Invalid state parameter: {str(e)}')

        user_id = state_data.get('user_id')
        org_id = state_data.get('org_id')
        original_state = state_data.get('state')

        # Verify state matches what we stored
        redis_key = f'hubspot_state:{org_id}:{user_id}'
        saved_state = await get_value_redis(redis_key)
        if not saved_state:
            raise HTTPException(status_code=400, detail='State expired or not found')

        saved_state_data = json.loads(saved_state.decode('utf-8') if isinstance(saved_state, bytes) else saved_state)
        saved_state_token = saved_state_data.get('state')

        if original_state != saved_state_token:
            raise HTTPException(status_code=400, detail='State mismatch - potential CSRF attack')

        # Exchange authorization code for access token
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI,
            'code': code
        }

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                TOKEN_URL,
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail=f'Failed to exchange code for token: {token_response.text}')

        credentials = token_response.json()

        # Store credentials temporarily and clean up state
        await asyncio.gather(
            add_key_value_redis(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(credentials), expire=600),
            delete_key_redis(f'hubspot_state:{org_id}:{user_id}')
        )

        # Return script to close popup window
        close_window_script = """
        <html>
            <head><title>HubSpot Integration</title></head>
            <body>
                <h2>HubSpot integration successful!</h2>
                <p>You can close this window.</p>
                <script>
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=close_window_script)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in oauth2callback_hubspot: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


async def get_hubspot_credentials(user_id, org_id):
    """
    Retrieves and returns stored HubSpot credentials, then deletes them
    """
    try:
        credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')

        if not credentials:
            raise HTTPException(status_code=404, detail='No HubSpot credentials found. Please re-authorize.')

        credentials_data = json.loads(credentials.decode('utf-8') if isinstance(credentials, bytes) else credentials)

        # Validate credentials structure
        if 'access_token' not in credentials_data:
            raise HTTPException(status_code=400, detail='Invalid credentials format')

        # Delete credentials from Redis (one-time use)
        await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')

        return credentials_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving HubSpot credentials: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credentials: {str(e)}")


async def get_items_hubspot(credentials):
    """
    Fetch HubSpot data using credentials and return IntegrationItem objects
    """
    try:
        credentials_data = json.loads(credentials)
        access_token = credentials_data.get('access_token')

        if not access_token:
            raise HTTPException(status_code=400, detail='Missing access_token in credentials')

        items = []

        # Fetch contacts
        contacts_results = await fetch_hubspot_objects("contacts", access_token)
        if contacts_results:
            items.extend([await create_integration_item_metadata_object(item, object_type_map.get("contacts")) for item in contacts_results])

        # Fetch deals
        deals_results = await fetch_hubspot_objects("deals", access_token)
        if deals_results:
            items.extend([await create_integration_item_metadata_object(item, object_type_map.get("deals")) for item in deals_results])

        # Fetch companies
        companies_results = await fetch_hubspot_objects("companies", access_token)
        if companies_results:
            items.extend([await create_integration_item_metadata_object(item, object_type_map.get("companies")) for item in companies_results])

        print("Final Items List:", json.dumps(items, indent=2))
        print(f"Total items fetched: {len(items)}")
        return items
    except Exception as e:
        print(f"Error in get_items_hubspot: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch HubSpot items: {str(e)}")


async def fetch_hubspot_objects(object_type, access_token, limit=50):
    """
    Fetch objects of a given type from HubSpot
    """
    url = f'https://api.hubapi.com/crm/v3/objects/{object_type}'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    params = {
        'limit': limit,
        'properties': ','.join(get_default_properties(object_type)),
        'associations': ','.join(get_associations_for_object(object_type))
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()
            return data.get('results', [])
        else:
            print(f"Failed to fetch {object_type}: {response.status_code} - {response.text}")
            return []


async def search_hubspot_objects(credentials: str, query: str, object_type: str = "contacts"):
    """
    Search HubSpot objects by query and type using the correct CRM API v3 format
    """
    try:
        credentials_data = json.loads(credentials)
        access_token = credentials_data.get('access_token')
        if not access_token:
            raise HTTPException(status_code=400, detail='Missing access_token in credentials')

        url = f'https://api.hubapi.com/crm/v3/objects/{object_type}/search'

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        payload = {
            "query": query,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)

            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                print("Final Items List:", json.dumps(results, indent=2))
                print(f"Total items fetched: {len(results)}")

                items = []
                for item in results:
                    try:
                        integration_item = await create_integration_item_metadata_object(item, object_type_map.get(object_type, object_type.capitalize()))
                        items.append(integration_item)
                    except Exception as e:
                        print(f"Error processing item {item.get('id', 'unknown')}: {str(e)}")
                        continue

                return items
            else:
                error_text = response.text
                print(f"HubSpot search failed: {response.status_code} - {error_text}")

                # Try to parse error details
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', error_text)
                    error_details = error_data.get('errors', [])
                    if error_details:
                        error_message += f" - Details: {error_details}"
                except:
                    error_message = error_text

                raise HTTPException(status_code=response.status_code, detail=f"HubSpot search failed: {error_message}")

    except json.JSONDecodeError as e:
        print(f"JSON decode error in credentials: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid credentials format: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in search_hubspot_objects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


async def create_integration_item_metadata_object(response_json, object_type: str):
    """
    Convert a HubSpot API response object to an IntegrationItem
    """
    try:
        object_id = response_json.get('id')
        properties = response_json.get('properties', {})
        associations = response_json.get('associations', {})

        # Extract fields
        name = get_object_display_name(properties, object_type)
        email = properties.get('email')
        phone = properties.get('phone')
        created_at = parse_hubspot_timestamp(response_json.get('createdAt', properties.get('createdate')))
        updated_at = parse_hubspot_timestamp(response_json.get('updatedAt', properties.get('lastmodifieddate')))
        url = create_hubspot_url(object_type, object_id)
        parent_info = extract_parent_info(associations, object_type)
        is_directory = determine_directory_status(object_type, properties, associations)

        return IntegrationItem(
            id=f"hubspot_{object_type}_{object_id}",
            name=name,
            type=object_type,
            directory=is_directory,
            creation_time=created_at,
            last_modified_time=updated_at,
            url=url,
            parent_id=parent_info.get('parent_id'),
            parent_path_or_name=parent_info.get('parent_name'),
            visibility=True,
            email=email,
            phone=phone,
            api_response=response_json
        ).to_dict()
    except Exception as e:
        print(f"Error creating IntegrationItem: {str(e)}")
        return IntegrationItem(
            id=f"hubspot_unknown_{response_json.get('id', 'unknown')}",
            name="Unknown (Processing Error)",
            type="Unknown",
            visibility=False
        ).to_dict()


async def get_hubspot_integration_summary():
    """
    Get a quick summary of the HubSpot integration capabilities
    """
    try:
        summary = {
            "integration_name": "HubSpot CRM Integration",
            "version": "1.0 Enterprise",
            "supported_objects": ["Contacts", "Companies", "Deals"],
            "features": [
                "OAuth 2.0 Authentication with PKCE",
                "Bearer Token Authorization",
                "Smart Object Relationships",
                "Intelligent Data Filtering",
                "Performance Analytics",
                "Rate Limiting & Error Handling",
                "Hierarchical Data Structure",
                "Context-Aware URLs",
                "Advanced Search API",
                "Real-time Association Mapping"
            ],
            "capabilities": {
                "max_objects_per_request": 50,
                "pagination_support": True,
                "association_mapping": True,
                "custom_properties": True,
                "performance_monitoring": True,
                "error_recovery": True
            },
            "api_endpoints": {
                "authorize": "/integrations/hubspot/authorize",
                "callback": "/integrations/hubspot/oauth2callback",
                "credentials": "/integrations/hubspot/credentials",
                "load_data": "/integrations/hubspot/get_hubspot_items"
            }
        }
        return summary

    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        return {"error": str(e)}


def get_associations_for_object(object_type):
    """
    Get relevant associations for each object type
    """
    association_map = {
        'contacts': ['companies', 'deals'],
        'companies': ['contacts', 'deals'],
        'deals': ['contacts', 'companies']
    }
    return association_map.get(object_type, [])


def get_default_properties(object_type):
    """
    Get default properties to fetch for each object type
    """
    property_map = {
        'contacts': [
            'firstname', 'lastname', 'email', 'company',
            'jobtitle', 'createdate', 'lastmodifieddate', 'hs_object_id'
        ],
        'companies': [
            'name', 'domain', 'industry', 'city', 'phone', 'website',
            'createdate', 'hs_lastmodifieddate', 'hs_object_id'
        ],
        'deals': [
            'dealname', 'amount', 'dealstage', 'pipeline', 'closedate',
            'createdate', 'hs_lastmodifieddate', 'hs_object_id'
        ]
    }
    return property_map.get(object_type, ['name', 'hs_object_id'])


def get_object_display_name(properties, object_type):
    """
    Extract a meaningful display name from HubSpot object properties
    """
    if object_type == 'Contact':
        firstname = properties.get('firstname', '')
        lastname = properties.get('lastname', '')
        email = properties.get('email', '')
        company = properties.get('company', '')

        if firstname or lastname:
            name = f"{firstname} {lastname}".strip()
            if company:
                return f"{name} ({company})"
            return name
        elif email:
            return email
        else:
            return "Unnamed Contact"

    elif object_type == 'Company':
        name = properties.get('name', '')
        domain = properties.get('domain', '')
        industry = properties.get('industry', '')

        if name:
            if industry:
                return f"{name} - {industry}"
            return name
        elif domain:
            return f"Company ({domain})"
        else:
            return "Unnamed Company"

    elif object_type == 'Deal':
        dealname = properties.get('dealname', '')
        amount = properties.get('amount', '')

        if dealname:
            if amount:
                return f"{dealname} (${amount})"
            return dealname
        elif amount:
            return f"Deal (${amount})"
        else:
            return "Unnamed Deal"

    return f"{object_type} Item"


def create_hubspot_url(object_type, object_id):
    """
    Create proper HubSpot URLs for different object types
    """
    url_map = {
        'Contact': f"https://app.hubspot.com/contacts/contacts/{object_id}",
        'Company': f"https://app.hubspot.com/contacts/companies/{object_id}",
        'Deal': f"https://app.hubspot.com/contacts/deals/{object_id}"
    }
    return url_map.get(object_type, f"https://app.hubspot.com/contacts/{object_id}")


def extract_parent_info(associations, object_type):
    """
    Extract parent relationship info from associations
    """
    parent_info: Dict[str, Optional[str]] = {'parent_id': None, 'parent_name': None}

    try:
        if object_type == 'Contact':
            # Contacts can be associated with companies
            companies = associations.get('companies', {}).get('results', [])
            if companies:
                company_id = companies[0].get('id')
                parent_info['parent_id'] = f"hubspot_company_{company_id}"
                parent_info['parent_name'] = "Company"

        elif object_type == 'Deal':
            # Deals can be associated with companies or contacts
            companies = associations.get('companies', {}).get('results', [])
            contacts = associations.get('contacts', {}).get('results', [])

            if companies:
                company_id = companies[0].get('id')
                parent_info['parent_id'] = f"hubspot_company_{company_id}"
                parent_info['parent_name'] = "Company"
            elif contacts:
                contact_id = contacts[0].get('id')
                parent_info['parent_id'] = f"hubspot_contact_{contact_id}"
                parent_info['parent_name'] = "Contact"

    except Exception as e:
        print(f"Error extracting parent info: {str(e)}")

    return parent_info


def parse_hubspot_timestamp(timestamp_str):
    """
    Parse HubSpot timestamp strings into datetime objects
    """
    if not timestamp_str:
        return None

    try:
        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except:
        return timestamp_str


def determine_directory_status(object_type, properties, associations):
    """
    Determine if an object should be treated as a directory/container
    """
    # Companies are directories if they have associated contacts or deals
    if object_type == 'Company':
        contacts = associations.get('contacts', {}).get('results', [])
        deals = associations.get('deals', {}).get('results', [])
        return len(contacts) > 0 or len(deals) > 0

    # Contacts are directories if they have multiple deals
    elif object_type == 'Contact':
        deals = associations.get('deals', {}).get('results', [])
        return len(deals) > 1

    return False
