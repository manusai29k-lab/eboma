# Project TODO - EBOMA System

## Phase 1: Database & Schema
- [x] Create merchants table (phone, passcode, name, role)
- [x] Create physical_products table (name, price, type, description)
- [x] Create digital_products table (name, price, type, description)
- [x] Create physical_orders table (merchant, customer, product, status)
- [x] Create digital_sales table (merchant, customer, product, proof image, status)
- [x] Generate migration SQL and apply

## Phase 2: Backend (db.ts + routers.ts)
- [x] Merchant auth (login by phone + passcode, signup, JWT session)
- [x] Merchant session middleware (parallel to Manus OAuth)
- [x] Physical orders CRUD (create by merchant, list/update by admin)
- [x] Digital sales CRUD (create by merchant with image upload, list by admin)
- [x] Products CRUD (admin only)
- [x] Merchants management (admin only)
- [x] Dashboard stats (admin only)
- [x] Reports with filters (admin only)
- [x] Owner notification on new order/sale

## Phase 3: Login & Signup UI
- [x] Login page (phone + passcode, EBOMA branding, IBRAHIM WALEED)
- [x] Signup page (name, phone, passcode)
- [x] Merchant session handling in frontend

## Phase 4: Merchant UI
- [x] Merchant dashboard (choose physical or digital)
- [x] Physical product order form
- [x] Digital product sale form (with image upload)
- [x] My orders list (merchant's own orders)

## Phase 5: Admin Dashboard
- [x] Admin overview (total orders, sales stats, charts)
- [x] All orders table (filterable, status update)
- [x] Products management (add/edit/delete)
- [x] Merchants management (list, performance, delete)
- [x] Reports page (filter by merchant, product, date, type)

## Phase 6: Integration & Testing
- [x] Owner notifications on new orders
- [x] Image upload for digital sales proof
- [x] Vitest tests for backend procedures
- [x] Final testing and delivery

## Phase 7: Dark Theme Redesign
- [x] Update index.css with dark theme (black bg, purple/green/orange accents)
- [x] Update App.tsx to use dark theme
- [x] Redesign Login page with dark professional style
- [x] Redesign MerchantDashboard with dark style
- [x] Update MerchantPhysical with dark style
- [x] Update MerchantDigital with dark style
- [x] Update MerchantOrders with dark style
- [x] Test and deliver with guide for opening all pages

## Bug Fixes
- [x] Fix admin login redirect loop - Gmail OAuth login redirects back to Login page instead of /admin
- [x] Fix error when merchant fills all fields in physical order form

## Bug Fixes - Round 2
- [x] Fix digital product form - product selection issue (same as physical form fix)
- [x] Fix physical product form - product selection issue (verify previous fix works)
- [x] Apply any file received from user before fixing both forms

## Phase 8: PDF Modifications (11 changes)

### Priority 1: RTL + Mobile (Modifications 3+4)
- [x] Change html lang to "ar" dir="rtl" in index.html
- [x] Remove maximum-scale=1 from meta viewport
- [x] Replace all fixed widths (w-[500px]) with responsive widths
- [x] Ensure all pages work on mobile screens
- [x] Verify RTL doesn't break design

### Priority 2: Security (Modifications 1+2) - DONE
- [x] Remove open signup page completely
- [x] Only admin can create merchant accounts from admin panel
- [x] Keep login page only (username + password)
- [x] Move admin login to hidden route (no link from main page)
- [x] Add brute force protection (lock after 5 failed attempts)

### Priority 3: Commission System (Modifications 6+7+8) - DONE
- [x] Physical: fixed commission per order in IQD (admin sets per merchant)
- [x] Digital: percentage commission with 3 levels (30%/40%/50%)
- [x] Admin creates merchant accounts with: name, username, password, type (physical/digital), commission
- [x] System auto-calates merchant earnings: orders × commission
- [x] Merchant doesn't see commission (admin only)
- [x] Price warning note on price fields (3 zeros reminder)
- [x] Manual product entry only (no product dropdown)

### Priority 4: Returns + Reports (Modifications 9+10) - DONE
- [x] Add "مرتجع" (returned) status to orders
- [x] Statuses: جديد → قيد التجهيز → تم الشحن → تم التسليم / ملغي / مرتجع
- [x] Returned orders don't count commission
- [x] Reports: total sales (physical+digital separate), total profits, per-merchant profits
- [x] Reports: completed vs returned vs cancelled counts
- [x] Reports: date filter (daily/weekly/monthly), merchant filter, trade type filter
- [x] CSV export

### Priority 5: Text + Security Headers (Modifications 5+11) - DONE
- [x] Update login page text: "نظام إدارة الطلبات EBOMA" + "سجل دخولك لإدارة طلباتك ومتابعة مبيعاتك"
- [x] Add security headers to server
- [x] Replace "مندوبة/مندوبات" with "تاجر/تجار" everywhere
- [x] Fix digital product form selection issue
- [x] Fix physical product form selection issue

## Password Reset by Admin - DONE
- [x] إضافة دالة updateMerchantPasscode في server/db.ts
- [x] إضافة إجراء merchants.resetPassword في server/routers.ts (admin-only)
- [x] إضافة زر "إعادة تعيين كلمة السر" في صفحة AdminMerchants
- [x] نافذة حوار تتيح إدخال كلمة سر يدوياً أو توليد عشوائي
- [x] عرض كلمة السر الجديدة للمدير (نص واضح قابل للنسخ)
- [x] تنبيه نجاح بعد التحديث
- [x] لا إضافة صفحة "نسيت كلمة السر" في واجهة التاجر
