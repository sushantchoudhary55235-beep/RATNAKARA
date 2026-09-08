# OceanAI Implementation Guide

> **For SIH 2026 Judges and Team Members**

---

## A. What OceanAI Does

OceanAI is an AI-powered ocean science assistant integrated into the RATNAKAR dashboard. It uses Google Gemini to answer questions about:

- Ocean temperature, salinity, currents, waves
- Bathymetry and ocean depth
- Marine observations (Argo floats, satellites)
- Arabian Sea, Bay of Bengal, Indian Ocean
- Climate and ocean warming
- Indian Ocean Dipole (IOD), El Niño/La Niña

The chatbot supports **English, Hindi, and Hinglish** based on the user's input language.

---

## B. How Gemini Is Connected

```
User Question
     ↓
FastAPI Endpoint (POST /api/v1/chat)
     ↓
Gemini Service (google-genai library)
     ↓
OceanAI System Prompt
     ↓
Google Gemini API
     ↓
Generated Answer
     ↓
JSON Response to Frontend
```

**Key points:**
- Uses `google-genai` Python library
- System instruction provides OceanAI's personality and rules
- Model: `gemini-3.8-flash` (configurable)
- API key stored in environment variable (never in code)

---

## C. File-by-File Explanation

### 1. `backend/app/schemas/chat.py`
Defines the request/response structure:
- `ChatRequest`: question (required) + optional context
- `ChatContext`: optional RATNAKAR data (lat, lon, depth, variable)
- `ChatResponse`: answer string

### 2. `backend/app/prompts/oceanai.py`
Contains the system prompt that defines OceanAI's behavior:
- Topics it can discuss
- Language rules
- Scientific accuracy rules
- Style guidelines

### 3. `backend/app/services/gemini_service.py`
Handles Gemini API communication:
- Creates Gemini client
- Builds context-aware prompts
- Calls Gemini API
- Handles errors and empty responses

### 4. `backend/app/api/chat.py`
FastAPI route for the chat endpoint:
- Validates request using Pydantic schemas
- Calls Gemini service
- Returns JSON response
- Handles errors gracefully

### 5. `backend/app/main.py`
Registers the chat router (minimal change):
```python
from app.api.chat import router as chat_router
app.include_router(chat_router)
```

### 6. `backend/tests/test_chat.py`
Comprehensive tests with mocked Gemini:
- Successful chat responses
- Validation errors (empty, whitespace)
- Gemini failure handling
- API key security verification

---

## D. Where to Put Your API Key

### Step 1: Get a Gemini API key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Copy the key (starts with `AIza...`)

### Step 2: Configure the backend
1. Navigate to `backend/`
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your key:
   ```
   GEMINI_API_KEY=your_actual_key_here
   GEMINI_MODEL=gemini-3.8-flash
   ```

### ⚠️ SECURITY RULES
- **NEVER** commit `.env` to Git
- **NEVER** share your API key
- **NEVER** put the key in source code
- **NEVER** display the key in logs or responses

---

## E. Where to Change the OceanAI Prompt

**File:** `backend/app/prompts/oceanai.py`

**Variable:** `OCEANAI_SYSTEM_PROMPT`

Example modifications:
```python
# Add a new topic
OCEANAI_SYSTEM_PROMPT = '''
...
### New Topics
- Marine renewable energy
- Offshore wind and wave energy
...
'''
```

**Important:** Changes to the prompt take effect immediately on server restart.

---

## F. Where to Change the Gemini Model

**Option 1: Environment variable (recommended)**
Edit `backend/.env`:
```
GEMINI_MODEL=gemini-2.0-flash
```

**Option 2: Default in code**
Edit `backend/app/services/gemini_service.py`:
```python
model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
```

### Available Models
- `gemini-3.8-flash` (default, fast)
- `gemini-2.0-flash` (newer, better quality)
- `gemini-2.5-pro` (highest quality, slower)

---

## G. How the Backend Endpoint Works

### Request Flow
1. Frontend sends `POST /api/v1/chat` with JSON body
2. FastAPI validates request using Pydantic schemas
3. Chat route extracts question and optional context
4. Gemini service builds the full prompt
5. System prompt + user question sent to Gemini
6. Response returned as JSON

### Example Request
```json
{
  "question": "What is ocean salinity?",
  "context": {
    "latitude": 18.5,
    "longitude": 72.8,
    "depth": 50
  }
}
```

### Example Response
```json
{
  "answer": "Ocean salinity is the concentration of dissolved salts in seawater, typically around 35 PSU (Practical Salinity Units) in the open ocean. In the Arabian Sea, salinity ranges from 35-37 PSU due to high evaporation..."
}
```

---

## H. How to Test OceanAI

### 1. Start the backend
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Open Swagger UI
Go to: http://localhost:8000/docs

### 3. Test the endpoint
1. Find `POST /api/v1/chat`
2. Click "Try it out"
3. Enter request body:
   ```json
   {
     "question": "What is ocean salinity?"
   }
   ```
4. Click "Execute"
5. Verify you get a 200 response with an answer

### 4. Test with context
```json
{
  "question": "What is the temperature here?",
  "context": {
    "latitude": 18.5,
    "longitude": 72.8,
    "depth": 50,
    "variable": "temperature"
  }
}
```

### 5. Run automated tests
```bash
cd backend
python -m pytest tests/test_chat.py -v
```

---

## I. How the Frontend Will Connect

### Frontend Code Example
```typescript
// services/api.ts
export async function chatWithOceanAI(question: string, context?: ChatContext) {
  const response = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context })
  });
  
  if (!response.ok) {
    throw new Error('OceanAI is unavailable');
  }
  
  return response.json();
}
```

### React Component Example
```tsx
function OceanAIChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  
  const handleSubmit = async () => {
    const result = await chatWithOceanAI(message);
    setResponse(result.answer);
  };
  
  return (
    <div>
      <input value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={handleSubmit}>Ask OceanAI</button>
      <p>{response}</p>
    </div>
  );
}
```

### Optional: Pass RATNAKAR Data
When user selects a location on the 3D map:
```typescript
const context = {
  latitude: selectedPoint.lat,
  longitude: selectedPoint.lon,
  depth: selectedPoint.depth,
  variable: selectedVariable
};

const result = await chatWithOceanAI(
  "What are the conditions at this location?",
  context
);
```

---

## J. How RATNAKAR Data Can Later Be Passed to Gemini

### Current Foundation
The optional `context` field in `ChatRequest` allows passing:
- Latitude/longitude
- Depth
- Variable name

### Future Enhancement: Auto-fetch Data
```
User Question + Context
     ↓
OceanAI Backend
     ↓
Auto-fetch relevant RATNAKAR data:
- /api/v1/model-field
- /api/v1/observations
- /api/v1/comparison
     ↓
Include data in Gemini prompt
     ↓
More accurate, data-aware response
```

### Example Future Flow
1. User asks: "What is the temperature at 18.5N, 72.8E?"
2. Backend fetches model field data for that location
3. Backend fetches nearest Argo observation
4. Backend includes both in the prompt to Gemini
5. Gemini provides explanation with actual data

**This is planned for future implementation.**

---

## K. Security Rules

### API Key Protection
- ✅ Stored in `.env` (gitignored)
- ✅ Loaded via `python-dotenv`
- ✅ Never exposed in responses
- ✅ Never logged or printed
- ✅ Never hardcoded

### Input Validation
- ✅ Question length limited to 2000 chars
- ✅ Whitespace-only questions rejected
- ✅ Context coordinates validated (lat: -90..90, lon: -180..180)
- ✅ Depth must be non-negative

### Error Handling
- ✅ Generic error messages to client
- ✅ Detailed errors logged server-side only
- ✅ API key never appears in error responses

---

## L. Troubleshooting

### Problem: "GEMINI_API_KEY is not configured"
**Solution:** Ensure `backend/.env` exists with your API key

### Problem: 500 error on chat endpoint
**Check:**
1. Is the API key valid?
2. Is the model name correct?
3. Is the Gemini API accessible?

### Problem: Slow responses
**Reason:** Gemini API latency (typically 1-3 seconds)
**Solution:** Use `gemini-3.8-flash` for faster responses

### Problem: Wrong language response
**Solution:** Ensure the question is in the desired language. The system prompt follows the user's language.

### Problem: Tests failing
**Check:**
1. Run `python -m pytest tests/test_chat.py -v`
2. Ensure mocking is working
3. Check for import errors

---

## M. SIH Judge Explanation

### What Makes OceanAI Special

1. **Scientific Accuracy**
   - System prompt enforces scientific caution
   - Never fabricates data
   - Distinguishes general knowledge from RATNAKAR data

2. **Multilingual Support**
   - English, Hindi, Hinglish
   - Follows user's language choice

3. **Data-Aware Foundation**
   - Optional context for location-specific answers
   - Ready for future RATNAKAR data integration

4. **Production-Ready**
   - Comprehensive error handling
   - Input validation
   - Security by design

### Demo Script
1. Ask: "What is ocean salinity?"
   → Get clear explanation

2. Ask: "What are conditions at 18.5N, 72.8E?"
   → Show location-aware response

3. Ask in Hindi: "समुद्र का तापमान क्या है?"
   → Get Hindi response

4. Show Swagger UI with endpoint documentation

5. Explain the architecture and future data integration plan

---

## Quick Reference

| What | Where |
|------|-------|
| API Key | `backend/.env` |
| System Prompt | `backend/app/prompts/oceanai.py` |
| Gemini Model | `backend/.env` → `GEMINI_MODEL` |
| Chat Endpoint | `backend/app/api/chat.py` |
| Schema | `backend/app/schemas/chat.py` |
| Tests | `backend/tests/test_chat.py` |
| Docs | `docs/OCEANAI_IMPLEMENTATION_GUIDE.md` |

---

**Last Updated:** SIH 2026
