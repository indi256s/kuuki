from test_helper import PaperClient
import json, os

client = PaperClient()
try:
    print("1. Creating Rankings study artboard (300x160)...")
    res = client.call('create_artboard', {
        'pageId': 'p-3-0',
        'name': '15 Rankings — Gemini dual-champion trophy study',
        'styles': {
            'width': '300px',
            'height': '160px',
            'backgroundColor': '#292827'
        }
    })
    study_info = json.loads(res[1]['text'])
    study_id = study_info['id']
    print(f"Created study artboard: {study_id}")

    print("2. Inserting SVG into study artboard...")
    with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-trophy-gemini.svg') as f:
        svg_content = f.read()

    wrapper_html = f'<div style="width: 300px; height: 160px; display: flex;">{svg_content}</div>'
    res_html = client.call('write_html', {
        'targetNodeId': study_id,
        'mode': 'insert-children',
        'html': wrapper_html
    })
    print("Inserted SVG into study artboard:", res_html[1]['text'][:200])

    print("3. Capturing study screenshot...")
    study_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-gemini-study.png'
    client.save_screenshot(study_id, study_png, scale=1)

    print("4. Duplicating NBN-0 for Rankings full sheet...")
    res_dup = client.call('duplicate_nodes', {
        'nodes': [{'id': 'NBN-0'}]
    })
    dup_data = json.loads(res_dup[1]['text'])['duplicatedNodes'][0]
    sheet_id = dup_data['newId']
    desc_map = dup_data['descendantIdMap']
    old_fig_id = desc_map['O2N-0'] # Figure in duplicate
    print(f"Created duplicate sheet: {sheet_id}, old figure node in duplicate: {old_fig_id}")

    print("5. Renaming duplicate sheet...")
    client.call('rename_nodes', {
        'nodes': [{'id': sheet_id, 'name': '16 Rankings — Gemini trophy in sheet'}]
    })

    print("6. Replacing figure in duplicate sheet...")
    sheet_fig_html = f'<div style="width: 300px; height: 160px; display: flex;" data-name="Figure — Gemini dual-champion trophy">{svg_content}</div>'
    res_replace = client.call('write_html', {
        'targetNodeId': old_fig_id,
        'mode': 'replace',
        'html': sheet_fig_html
    })
    print("Replaced figure in duplicate sheet:", res_replace[1]['text'][:200])

    print("7. Capturing full sheet screenshot...")
    sheet_png = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-gemini-sheet.png'
    client.save_screenshot(sheet_id, sheet_png, scale=1)

finally:
    client.close()
print("Rankings drawing complete!")
