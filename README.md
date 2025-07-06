# Integrata

**Integrata is a unified platform to securely connect, search, and manage your CRM data across HubSpot, Airtable, and Notion—all in one place.**

---

## 🚀 Project Motivation
Modern businesses use multiple SaaS tools, but accessing and managing data across them can be a hassle. Integrata streamlines this by providing a single, secure interface for authentication, data loading, and advanced search—empowering teams to work smarter, not harder.

---

## ✨ Features
- **Secure OAuth 2.0 Authentication** for HubSpot, Airtable, and Notion
- **Easy Connect & Reconnect** with clear status indicators
- **Unified Data Table** for contacts, companies, deals, and more
- **Advanced Search** with type filtering and instant results
- **Integration Summary**: View supported features and API endpoints
- **Modern, Responsive UI** built with React & Material UI
- **Robust Error Handling** and user feedback
- **Reusable Hooks & Components** for scalable development

---

## 🛠️ Tech Stack
- **Backend:** Python, FastAPI, Redis, httpx
- **Frontend:** React, Material UI, Axios
- **Cache/Session:** Redis (for OAuth state and credentials)

---

## ⚡ Getting Started

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd <repo-directory>
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm start
```

### 4. Redis Setup (Required for OAuth/session)
- **Quick start with Docker:**
```bash
docker run --name integrata-redis -p 6379:6379 -d redis
```
- Or [install Redis locally](https://redis.io/download)

---

## 💡 Usage
1. Open your browser at [http://localhost:3000](http://localhost:3000)
2. Select an integration (HubSpot, Airtable, Notion)
3. Enter your user and organization info
4. Click **Connect** to authenticate via OAuth
5. Load, search, and explore your data in a unified table
6. Use **Reload Data** and **Clear Data** as needed

---

## ⚙️ Configuration
- **Environment Variables:**
  - For production, set OAuth client IDs/secrets in environment variables or a `.env` file (see below)
- **API Endpoints:**
  - Backend: `http://localhost:8001`
  - Frontend expects backend at this address (update if needed)

### Example `.env` (backend)
```
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:8001/integrations/hubspot/oauth2callback
# Add similar for Airtable, Notion, etc.
REDIS_URL=redis://localhost:6379
```

---

## 📬 Contact
For questions or support, contact [rahulhiragond04@gmail.com]. 
