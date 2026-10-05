@echo off
echo Opening admin panel...
echo Local dev key: localdev (works only from 127.0.0.1)
echo In production set env BP_ADMIN_KEY - the admin API is disabled without it
start "" "http://127.0.0.1:9000/admin.html"
