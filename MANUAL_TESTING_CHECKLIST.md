# 🧪 Manual Testing Checklist - Theme Toggle Functionality

## 🎯 Testing Objective
Verify that all theme toggle fixes are working correctly across the CMRP Opps Management application.

## 📋 Test Checklist

### 1. **Theme Toggle Icon Test**
- [ ] Navigate to login page: `http://localhost:3001/login.html`
- [ ] Look at theme toggle button in header
- [ ] **Expected:** Should show sun icon (wb_sunny) ☀️
- [ ] Click theme toggle button
- [ ] **Expected:** Icon should remain sun (☀️) - NOT change to moon
- [ ] Switch themes multiple times
- [ ] **Expected:** Icon always stays as sun

### 2. **CMRP Logo Test**
- [ ] On login page, observe header logo
- [ ] **Expected:** Should show light logo (white/light colored CMRP logo)
- [ ] Switch to dark theme
- [ ] **Expected:** Logo should remain light (same light logo)
- [ ] Switch back to light theme
- [ ] **Expected:** Logo should still be light (no switching)

### 3. **Login Button Color Test**
- [ ] On login page, look at "Sign In" button
- [ ] **Expected:** Button should be blue (#1a73e8) - NOT purple
- [ ] Switch to dark theme
- [ ] **Expected:** Button should remain blue (same blue color)
- [ ] Hover over button in both themes
- [ ] **Expected:** Hover color should be darker blue (#174ea6)

### 4. **All Pages Consistency Test**
Test the same 3 elements on ALL pages:

#### Login Page
- [ ] `http://localhost:3001/login.html`
- [ ] Sun icon ✓ | Light logo ✓ | Blue button ✓

#### Main Dashboard
- [ ] `http://localhost:3001/index.html`
- [ ] Sun icon ✓ | Light logo ✓

#### User Management
- [ ] `http://localhost:3001/user_management.html`
- [ ] Sun icon ✓ | Light logo ✓

#### Update Password
- [ ] `http://localhost:3001/update_password.html`
- [ ] Sun icon ✓ | Light logo ✓

#### Forecast Dashboard
- [ ] Navigate to Forecast Dashboard from main menu
- [ ] Sun icon ✓ | Light logo ✓

#### Win-Loss Dashboard
- [ ] Navigate to Win-Loss Dashboard from main menu
- [ ] Sun icon ✓ | Light logo ✓

#### Executive Dashboard
- [ ] Navigate to Executive Dashboard from main menu
- [ ] Sun icon ✓ | Light logo ✓

### 5. **Theme Toggle Functionality Test**
- [ ] On any page, click theme toggle
- [ ] **Expected:** Page should switch between light/dark theme
- [ ] **Expected:** Background colors, text colors change appropriately
- [ ] **Expected:** Theme preference is remembered when navigating between pages
- [ ] Test theme switching on multiple pages
- [ ] **Expected:** All pages respect the selected theme

### 6. **Test Page Verification**
- [ ] Open: `http://localhost:3001/theme_toggle_test.html`
- [ ] This page should demonstrate all the fixes in action
- [ ] **Expected:** Shows current implementation with corrected requirements

## ✅ Success Criteria
**ALL of the following must be true:**
1. ☀️ **Sun icon appears in theme toggle on ALL pages in BOTH themes**
2. 🏢 **Light CMRP logo appears on ALL pages in BOTH themes**
3. 🔵 **Blue login button appears on login page in BOTH themes**
4. 🔄 **Theme switching works properly (backgrounds/text change)**
5. 💾 **Theme preference is maintained across page navigation**

## 🚨 If Any Test Fails
If any test fails, please report:
1. Which page failed
2. Which element failed (icon/logo/button)
3. What you saw vs. what was expected
4. Which theme you were in when it failed

---

## 📊 Test Results
**Date Tested:** ___________  
**Tested By:** ___________  
**Overall Result:** ☐ PASS | ☐ FAIL  
**Notes:** 

___________________________________________
___________________________________________
___________________________________________
