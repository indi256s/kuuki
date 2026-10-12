from test_helper import PaperClient
import json, os

client = PaperClient()
try:
    with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-sleepkit-gemini.svg') as f:
        svg_content = f.read()

    print("1. Updating Crossings study artboard RFN-0 (replacing RFO-0)...")
    wrapper_html = f'<div style="width: 300px; height: 160px; display: flex;">{svg_content}</div>'
    res_study = client.call('write_html', {
        'targetNodeId': 'RFO-0',
        'mode': 'replace',
        'html': wrapper_html
    })
    data_study = json.loads(res_study[1]['text'])
    new_study_child = data_study['createdNodes'][0]['id']
    print(f"New study child: {new_study_child}")

    print("2. Capturing study screenshot RFN-0...")
    study_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-gemini-study.png'
    client.save_screenshot('RFN-0', study_png, scale=1)

    print("3. Updating Crossings full sheet RGI-0 (replacing RL0-0)...")
    sheet_fig_html = f'<div style="width: 300px; height: 160px; display: flex;" data-name="Figure — Gemini sleep sanctuary kit">{svg_content}</div>'
    res_sheet = client.call('write_html', {
        'targetNodeId': 'RL0-0',
        'mode': 'replace',
        'html': sheet_fig_html
    })
    data_sheet = json.loads(res_sheet[1]['text'])
    new_sheet_fig = data_sheet['createdNodes'][0]['id']
    print(f"New sheet figure node: {new_sheet_fig}")

    print("4. Capturing full sheet screenshot RGI-0...")
    sheet_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-gemini-sheet.png'
    client.save_screenshot('RGI-0', sheet_png, scale=1)

finally:
    client.close()
print("Crossings update complete!")
