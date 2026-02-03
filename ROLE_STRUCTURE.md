# CMRP Role Structure Documentation

## Role Hierarchy and Definitions

This document defines the correct role structure for the CMRP Opportunities Management system.

### 🏢 **Account Managers** (Active)
*Primary sales responsibility and revenue ownership*

- **RTR** - Active
- **LOS** - Active  
- **JMO** - Active
- **CBD** - Active
- **ISP** - Active
- **NSG** - Active
- **TJC** - Active
- **JEB** - Active
- **RJR** - Active

**Total: 9 Account Managers**

---

### 👨‍💼 **PICs (Person In Charge)** 
*All Account Managers + Additional Technical Leads*

**Active Account Managers (also PICs):**
- RTR, LOS, JMO, CBD, ISP, NSG, TJC, JEB, RJR

**Additional PICs (not Account Managers):**
- **CBG** - Active
- **ASB** - Active  
- **VIB** - Active

**Resigned PICs (kept for historical filtering):**
- **AVR** - Resigned
- **EIS** - Resigned
- **MMR** - Resigned
- **MRB** - Resigned
- **RPV** - Resigned

**Total: 17 PICs (9 active Account Managers + 3 active PICs + 5 resigned)**

---

### 📋 **BOMs (Bill of Materials)** 
*All PICs + External Partners*

**All PICs are BOMs:**
- RTR, LOS, JMO, CBD, ISP, NSG, TJC, JEB, RJR (Account Managers)
- CBG, ASB, VIB (Additional PICs)
- AVR, EIS, MMR, MRB, RPV (Resigned PICs)

**Additional BOMs (External Partners):**
- **Partner** - External partners
- **SubCon** - Subcontractors

**Total: 19 BOMs (17 PICs + 2 external)**

---

## Database Implementation

### Role Definitions Table
```sql
CREATE TABLE role_definitions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('account_manager', 'pic', 'bom')),
    is_active BOOLEAN DEFAULT TRUE,
    is_resigned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Utility Functions
- `is_account_manager(code)` - Check if someone is an active account manager
- `get_account_managers(include_resigned)` - Get list of account managers

### API Behavior
- **Account Manager Dashboard**: Only shows the 9 active Account Managers
- **PIC Filters**: Would show all 17 PICs (including resigned for historical data)
- **BOM Filters**: Would show all 19 BOMs including external partners

---

## Current Data Status

### Account Managers with Opportunities:
- **NSG**: 80 opportunities, ₱148M submitted
- **RJR**: 68 opportunities, ₱257M submitted  
- **TJC**: 7 opportunities
- **JEB**: 6 opportunities
- **JMO**: 5 opportunities
- **ISP**: 2 opportunities
- **RTR**: 1 opportunity

### Account Managers without Opportunities (yet):
- **CBD**: 0 opportunities
- **LOS**: 0 opportunities

*These will appear in the dashboard once they have opportunities assigned.*

---

## System Behavior

✅ **Correct**: Account Manager Dashboard shows only people who are actual Account Managers AND have opportunities  
✅ **Correct**: API rejects requests for non-Account Managers (e.g., CBG returns error)  
✅ **Correct**: Role validation ensures data integrity  
✅ **Correct**: Historical resigned people available for filtering but not active tracking  

---

*Last Updated: August 2025*