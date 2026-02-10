# SerpAPI Setup Guide

## Why SerpAPI?
✅ **100 free searches/month** - No credit card required  
✅ **More reliable** than Google Custom Search API  
✅ **Simpler setup** - Just needs one API key  
✅ **Better results** - Returns clean, structured data  
✅ **No CAPTCHA issues** - Professional API service

---

## Quick Setup (5 minutes)

### Step 1: Get Your Free API Key

1. **Sign up** → [https://serpapi.com/users/sign_up](https://serpapi.com/users/sign_up)
   - Use your email and create a password
   - No credit card required for free tier

2. **Verify your email** (check inbox/spam)

3. **Get your API key** → [https://serpapi.com/manage-api-key](https://serpapi.com/manage-api-key)
   - Your key will be displayed on this page
   - Copy it (looks like: `abc123def456...`)

### Step 2: Add to Your Project

1. Open `ai/.env` file

2. Add this line (replace with your actual key):
   ```bash
   SERPAPI_KEY=your_actual_api_key_here
   ```

3. Save the file

### Step 3: Test It Works

Run a quick test to verify:
```bash
cd ai
python -c "from config import settings; print('✅ API Key loaded!' if settings.SERPAPI_KEY else '❌ API Key missing')"
```

---

## Usage Limits

### Free Tier (Default)
- **100 searches/month** 
- Perfect for development and testing
- Resets on the 1st of each month

### What Uses a Search?
- Each topic generation: **2-3 searches**
- Each content generation: **2-3 searches**
- **Estimate:** ~30-50 content generations per month

### Need More?
Paid plans start at $50/month for 5,000 searches:
- [View pricing](https://serpapi.com/pricing)
- Only upgrade if you exceed 100 searches/month

---

## How It Works

### Before (Slow Method)
1. Search Google manually → 5 seconds
2. Scrape each webpage → 10-20 seconds **per page**
3. Extract text → 2-3 seconds per page
4. **Total:** 45-60 seconds for 5 pages

### After (With SerpAPI)
1. Call SerpAPI → **2 seconds total**
2. Get pre-extracted snippets from all results
3. **Total:** 2 seconds for 10 results ⚡

**Result:** 20-30x faster content discovery!

---

## Troubleshooting

### "SerpAPI not configured" warning?
**Solution:** Check your `.env` file has `SERPAPI_KEY=your_key`

### "API quota exceeded" error?
**Solution:** You've used 100 searches this month
- Wait for next month (resets on 1st)
- Or upgrade to paid plan
- System will automatically fall back to scraping

### "Invalid API key" error?
**Solution:** 
1. Verify key in [your dashboard](https://serpapi.com/manage-api-key)
2. Make sure no extra spaces in `.env` file
3. Restart your application after updating `.env`

### No results returned?
**Solution:** Check logs for specific error:
```bash
grep "SerpAPI error" logs/app.log
```

---

## API Key Security

### ✅ DO:
- Keep your `.env` file in `.gitignore`
- Never commit API keys to git
- Use environment variables in production

### ❌ DON'T:
- Share your API key publicly
- Hardcode keys in source files
- Commit `.env` to version control

---

## Monitoring Usage

### Check Your Usage
1. Login to [SerpAPI Dashboard](https://serpapi.com/dashboard)
2. View "API Usage" section
3. See remaining searches for current month

### Check Application Logs
Your app logs every search:
```bash
grep "serpapi_search" logs/app.log
```

Example log entry:
```
INFO: serpapi_search query="SEO tips" results=10
```

---

## Performance Impact

### Expected Speed Improvements
- **Topic Generation:** 8s → 2-3s (5x faster) ⚡
- **Content Generation:** 50s → 12-15s (3-4x faster) ⚡

### Why So Fast?
1. **No scraping** - Uses Google's pre-extracted snippets
2. **Parallel operations** - Multiple searches at once
3. **Batch embedding** - Process all text in one call
4. **Smart caching** - Reuses results when possible

---

## FAQ

**Q: Will it work without SerpAPI?**  
A: Yes! System automatically falls back to web scraping if API unavailable.

**Q: How accurate are the snippets?**  
A: Very accurate - they're extracted directly by Google's algorithms.

**Q: Can I use my own Google API?**  
A: Google Custom Search is deprecated in this project due to reliability issues, but the code is backwards compatible.

**Q: What if I exceed 100 searches?**  
A: System automatically switches to web scraping (slower but still works).

**Q: Is this production-ready?**  
A: Yes! Includes error handling, logging, and automatic fallbacks.

---

## Next Steps

✅ **Setup complete?** Test your first content generation!

```bash
cd ai
uvicorn main:app --reload --port 8081
```

Then generate a topic to see the speed improvement!

---

**Need Help?** Check application logs or contact support.

**Performance tip:** Monitor your usage to stay within free tier limits.
