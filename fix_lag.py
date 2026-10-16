"""fix_lag — speechTimeout auto→1, AMD machine_start no longer hangs up"""

BOT = r"C:\Users\jader\ai-sales-bot\src"

with open(f"{BOT}\index.ts", "r", encoding="utf-8") as f:
    src = f.read()

original = src

# 1. speechTimeout "auto" -> "1" everywhere
count = src.count('speechTimeout="auto"')
src = src.replace('speechTimeout="auto"', 'speechTimeout="1"')
print(f"Fixed: replaced {count} speechTimeout='auto' with '1'")

# 2. AMD: only hang up on machine_end, not machine_start
old_amd = '  if (answeredBy === "machine_start") {\n    console.log("[AMD] machine_start \xe2\x80\x94 hanging up to prevent voicemail bleed");\n    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);\n  }'

new_amd = '  // machine_end = definite voicemail; machine_start = uncertain (may be slow human pickup)\n  if (answeredBy === "machine_end") {\n    console.log("[AMD] machine_end \xe2\x80\x94 definite voicemail, hanging up");\n    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);\n  }\n  if (answeredBy === "machine_start") {\n    console.log("[AMD] machine_start \xe2\x80\x94 uncertain, continuing as human");\n  }'

if old_amd in src:
    src = src.replace(old_amd, new_amd, 1)
    print("Fixed: AMD machine_start no longer hangs up")
else:
    print("WARN: AMD pattern not found, checking...")
    idx = src.find('"machine_start"')
    if idx != -1:
        print(repr(src[max(0,idx-200):idx+300]))

with open(f"{BOT}\index.ts", "w", encoding="utf-8", newline="\n") as f:
    f.write(src)

print("Done fix_lag")
