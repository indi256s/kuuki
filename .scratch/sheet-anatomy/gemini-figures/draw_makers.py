from test_helper import PaperClient
from PIL import Image
import json, time

client = PaperClient()
try:
    print("1. Creating Makers study artboard (300x160) at x=7000, y=0...")
    res = client.call('create_artboard', {
        'pageId': 'p-3-0',
        'name': '19 Makers — Gemini aero-sting airframe study',
        'styles': {
            'width': '300px',
            'height': '160px',
            'backgroundColor': '#292827',
            'left': '7000px',
            'top': '0px'
        }
    })
    study_id = json.loads(res[1]['text'])['id']
    print(f"Created Makers study artboard: {study_id}")

    client.call('update_styles', {
        'updates': [{'nodeIds': [study_id], 'styles': {'left': '7000px', 'top': '0px'}}]
    })

    print("2. Inserting Makers SVG into study artboard...")
    with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/makers-aerosting-gemini.svg') as f:
        svg_content = f.read()

    wrapper_html = f'<div style="width: 300px; height: 160px; display: flex;">{svg_content}</div>'
    res_w = client.call('write_html', {
        'targetNodeId': study_id,
        'mode': 'insert-children',
        'html': wrapper_html
    })
    print("Inserted SVG into Makers study artboard.")

    print("3. Duplicating O6L-0 for Makers full sheet...")
    res_dup = client.call('duplicate_nodes', {
        'nodes': [{'id': 'O6L-0'}]
    })
    dup_data = json.loads(res_dup[1]['text'])['duplicatedNodes'][0]
    sheet_id = dup_data['newId']
    desc_map = dup_data['descendantIdMap']
    old_fig_id = desc_map['OAO-0'] # Old figure node in duplicate
    print(f"Created duplicate sheet: {sheet_id}, old figure: {old_fig_id}")

    print("4. Renaming and positioning duplicate sheet at x=7000, y=240...")
    client.call('rename_nodes', {
        'updates': [{'nodeId': sheet_id, 'name': '20 Makers — Gemini aero-sting in sheet'}]
    })
    client.call('update_styles', {
        'updates': [{'nodeIds': [sheet_id], 'styles': {'left': '7000px', 'top': '240px'}}]
    })

    print("5. Replacing figure in Makers duplicate sheet...")
    sheet_fig_html = f'<div style="position: absolute; left: 45px; top: 8px; width: 300px; height: 160px; display: flex;" data-name="Figure — Gemini aero-sting airframe">{svg_content}</div>'
    res_rep = client.call('write_html', {
        'targetNodeId': old_fig_id,
        'mode': 'replace',
        'html': sheet_fig_html
    })
    new_fig_id = json.loads(res_rep[1]['text'])['createdNodes'][0]['id']
    print(f"Replaced figure in sheet: {new_fig_id}")

    # Brief pause for Paper layout engine
    time.sleep(2)

    print("6. Capturing Makers screenshots...")
    study_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/makers-gemini-study.png'
    client.save_screenshot(study_id, study_png, scale=1)
    im1 = Image.open(study_png)
    print(f"Study screenshot saved: {im1.size}, bytes: {len(open(study_png, 'rb').read())}, colors: {len(im1.getcolors(maxcolors=1000) or [])}")

    sheet_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/makers-gemini-sheet.png'
    client.save_screenshot(sheet_id, sheet_png, scale=1)
    im2 = Image.open(sheet_png)
    print(f"Sheet screenshot saved: {im2.size}, bytes: {len(open(sheet_png, 'rb').read())}, colors: {len(im2.getcolors(maxcolors=1000) or [])}")

finally:
    client.close()
print("Makers drawing complete!")
