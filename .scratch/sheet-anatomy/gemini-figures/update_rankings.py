from test_helper import PaperClient
import json, os

client = PaperClient()
try:
    with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-trophy-gemini.svg') as f:
        svg_content = f.read()

    print("1. Capturing study screenshot R1P-0...")
    study_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-gemini-study.png'
    client.save_screenshot('R1P-0', study_png, scale=1)

    print("2. Updating Rankings full sheet RB0-0 (replacing REN-0)...")
    sheet_fig_html = f'<div style="width: 300px; height: 160px; display: flex;" data-name="Figure — Gemini dual-champion trophy">{svg_content}</div>'
    res_sheet = client.call('write_html', {
        'targetNodeId': 'REN-0',
        'mode': 'replace',
        'html': sheet_fig_html
    })
    data = json.loads(res_sheet[1]['text'])
    new_sheet_fig = data['createdNodes'][0]['id']
    print(f"New sheet figure node: {new_sheet_fig}")

    print("3. Capturing full sheet screenshot RB0-0...")
    sheet_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-gemini-sheet.png'
    client.save_screenshot('RB0-0', sheet_png, scale=1)

finally:
    client.close()
print("Rankings update complete!")
