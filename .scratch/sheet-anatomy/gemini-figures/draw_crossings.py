from test_helper import PaperClient
from PIL import Image
import json, os

client = PaperClient()
try:
    print("1. Creating Crossings study artboard (300x160) at x=6500, y=0...")
    res = client.call('create_artboard', {
        'pageId': 'p-3-0',
        'name': '17 Crossings — Gemini sleep sanctuary study',
        'styles': {
            'width': '300px',
            'height': '160px',
            'backgroundColor': '#292827',
            'left': '6500px',
            'top': '0px'
        }
    })
    study_id = json.loads(res[1]['text'])['id']
    print(f"Created Crossings study artboard: {study_id}")

    # Explicitly ensure positioning
    client.call('update_styles', {
        'updates': [{'nodeIds': [study_id], 'styles': {'left': '6500px', 'top': '0px'}}]
    })

    print("2. Inserting Crossings SVG into study artboard...")
    with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-sleepkit-gemini.svg') as f:
        svg_content = f.read()

    wrapper_html = f'<div style="width: 300px; height: 160px; display: flex;">{svg_content}</div>'
    res_w = client.call('write_html', {
        'targetNodeId': study_id,
        'mode': 'insert-children',
        'html': wrapper_html
    })
    print("Inserted SVG into study artboard.")

    print("3. Capturing Crossings study screenshot...")
    study_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-gemini-study.png'
    client.save_screenshot(study_id, study_png, scale=1)
    im1 = Image.open(study_png)
    print(f"Study screenshot saved: {im1.size}, colors count: {len(im1.getcolors(maxcolors=1000) or [])}")

    print("4. Duplicating NQV-0 for Crossings full sheet...")
    res_dup = client.call('duplicate_nodes', {
        'nodes': [{'id': 'NQV-0'}]
    })
    dup_data = json.loads(res_dup[1]['text'])['duplicatedNodes'][0]
    sheet_id = dup_data['newId']
    desc_map = dup_data['descendantIdMap']
    old_fig_id = desc_map['O3G-0'] # Old counter figure in duplicate
    print(f"Created duplicate sheet: {sheet_id}, old figure: {old_fig_id}")

    print("5. Renaming and positioning duplicate sheet at x=6500, y=240...")
    client.call('rename_nodes', {
        'updates': [{'nodeId': sheet_id, 'name': '18 Crossings — Gemini sleep kit in sheet'}]
    })
    client.call('update_styles', {
        'updates': [{'nodeIds': [sheet_id], 'styles': {'left': '6500px', 'top': '240px'}}]
    })

    print("6. Replacing figure in Crossings duplicate sheet...")
    sheet_fig_html = f'<div style="position: absolute; left: 45px; top: 8px; width: 300px; height: 160px; display: flex;" data-name="Figure — Gemini sleep kit">{svg_content}</div>'
    res_rep = client.call('write_html', {
        'targetNodeId': old_fig_id,
        'mode': 'replace',
        'html': sheet_fig_html
    })
    new_fig_id = json.loads(res_rep[1]['text'])['createdNodes'][0]['id']
    print(f"Replaced figure in sheet: {new_fig_id}")

    print("7. Capturing Crossings full sheet screenshot...")
    sheet_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-gemini-sheet.png'
    client.save_screenshot(sheet_id, sheet_png, scale=1)
    im2 = Image.open(sheet_png)
    print(f"Sheet screenshot saved: {im2.size}, colors count: {len(im2.getcolors(maxcolors=1000) or [])}")

finally:
    client.close()
print("Crossings drawing complete!")
