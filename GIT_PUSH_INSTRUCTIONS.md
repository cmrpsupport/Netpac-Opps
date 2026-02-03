# Git Push Instructions for SQLiteCloud Repository

## Repository Setup Complete ✅

Your new SQLiteCloud repository has been:
- ✅ Created in: `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud`
- ✅ Git initialized with all files committed
- ✅ Remote added: https://github.com/cmrpsupport/cmrp-oppx.git
- ✅ Dependencies installed (node_modules)

## Next Step: Push to GitHub

You need to push the repository to GitHub. Here's how:

### Option 1: Using GitHub Desktop (Easiest)

1. Open **GitHub Desktop**
2. Click **File** → **Add Local Repository**
3. Browse to: `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud`
4. Click **Add Repository**
5. Click **Publish repository** or **Push origin**
6. Authenticate if prompted

### Option 2: Using Command Line with Personal Access Token

1. **Generate a Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click **Generate new token (classic)**
   - Select scopes: `repo` (full control)
   - Click **Generate token**
   - **Copy the token** (you won't see it again!)

2. **Push using the token:**
   ```bash
   cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"
   git branch -M main
   git push -u origin main
   ```

   When prompted for username: `nyllecmrp`
   When prompted for password: **paste your token**

### Option 3: Using SSH (Most Secure)

1. **Generate SSH key (if you don't have one):**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **Add SSH key to GitHub:**
   - Copy your public key:
     ```bash
     cat ~/.ssh/id_ed25519.pub
     ```
   - Go to: https://github.com/settings/ssh/new
   - Paste the key and save

3. **Change remote to SSH:**
   ```bash
   cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"
   git remote set-url origin git@github.com:cmrpsupport/cmrp-oppx.git
   git push -u origin main
   ```

## After Pushing

Once pushed, your repository will be available at:
**https://github.com/cmrpsupport/cmrp-oppx**

## Two Repository Strategy

You now have **two versions** of your application:

### 1. Original Repository (PostgreSQL)
- **Location:** `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx`
- **Database:** PostgreSQL (Neon)
- **Remote:** Your original GitHub repository
- **Use for:** Production with PostgreSQL

### 2. SQLiteCloud Repository (New)
- **Location:** `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud`
- **Database:** SQLiteCloud
- **Remote:** https://github.com/cmrpsupport/cmrp-oppx
- **Use for:** New production with SQLiteCloud

## Working with Both Repositories

### PostgreSQL Version (Original)
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx"
# Work here for PostgreSQL version
git add .
git commit -m "Your changes"
git push
```

### SQLiteCloud Version (New)
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"
# Work here for SQLiteCloud version
git add .
git commit -m "Your changes"
git push
```

## Syncing Changes Between Repositories

If you make a feature change in one repository and want it in the other:

### Option A: Cherry-pick commits
```bash
# In the target repository
git remote add other-repo ../CMRP-Oppx
git fetch other-repo
git cherry-pick <commit-hash>
```

### Option B: Manual copy
Just copy the changed files between directories and commit.

## Environment Files

Remember each repository uses different `.env` files:

**PostgreSQL version:**
```env
DATABASE_URL=postgresql://opps_management_owner:...
```

**SQLiteCloud version:**
```env
DATABASE_URL=sqlitecloud://cguxse6mvk.g4.sqlite.cloud:8860/cmrp-oppx?apikey=...
```

## Quick Reference

| Task | Command |
|------|---------|
| Check status | `git status` |
| View commits | `git log --oneline` |
| View remote | `git remote -v` |
| Pull changes | `git pull` |
| Push changes | `git push` |
| Switch repos | `cd "../CMRP-Oppx"` or `cd "../CMRP-Oppx-SQLiteCloud"` |

## Troubleshooting

### "Permission denied"
- Use a Personal Access Token instead of password
- Or set up SSH keys

### "Repository not found"
- Check you're logged in as the correct GitHub user
- Verify the repository exists: https://github.com/cmrpsupport/cmrp-oppx

### "Failed to push"
- Make sure you have write access to the repository
- Check your authentication (token or SSH key)

---

**Ready to push?** Choose one of the options above and push your new SQLiteCloud repository to GitHub!
