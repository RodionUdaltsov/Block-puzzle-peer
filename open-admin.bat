@echo off
echo Opening admin panel...
echo Default key: localdev  (override with env BP_ADMIN_KEY)
start "" "http://127.0.0.1:9000/admin.html"
