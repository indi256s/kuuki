import subprocess, json, select, time, os, base64

class PaperClient:
    def __init__(self, file_id='01M48F4SHK61AZS2FH5P5JPRY7', page_id='p-3-0'):
        self.file_id = file_id
        self.page_id = page_id
        self.proc = subprocess.Popen(
            ['/Users/indi256/.paper/bin/paper', 'mcp'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1
        )
        self.req_id = 1
        self._init()

    def _init(self):
        self.rpc('initialize', {
            'protocolVersion': '2024-11-05',
            'capabilities': {},
            'clientInfo': {'name': 'kuuki-gemini-drawing', 'version': '1.0'}
        })
        self.proc.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
        self.proc.stdin.flush()
        self.call('open_file', {'fileId': self.file_id, 'pageId': self.page_id})

    def rpc(self, method, params=None, timeout=30):
        cid = self.req_id
        self.req_id += 1
        payload = {'jsonrpc': '2.0', 'id': cid, 'method': method}
        if params is not None:
            payload['params'] = params
        self.proc.stdin.write(json.dumps(payload) + '\n')
        self.proc.stdin.flush()
        
        start = time.time()
        while time.time() - start < timeout:
            r, _, _ = select.select([self.proc.stdout], [], [], 1.0)
            if r:
                line = self.proc.stdout.readline()
                if not line: break
                try:
                    data = json.loads(line)
                    if data.get('id') == cid:
                        return data
                except: pass
        return None

    def call(self, tool_name, args, timeout=30):
        args['fileId'] = self.file_id
        res = self.rpc('tools/call', {'name': tool_name, 'arguments': args}, timeout=timeout)
        if not res or 'result' not in res:
            raise RuntimeError(f'Error calling {tool_name}: {res}')
        content = res['result'].get('content', [])
        return content

    def save_screenshot(self, node_id, out_png_path, scale=1):
        content = self.call('get_screenshot', {'nodeId': node_id, 'scale': scale}, timeout=45)
        # Check image item
        for item in content:
            if item.get('type') == 'image':
                img_data = base64.b64decode(item.get('data'))
                with open(out_png_path, 'wb') as f:
                    f.write(img_data)
                print(f'Screenshot saved to {out_png_path} ({len(img_data)} bytes)')
                return True
            elif item.get('type') == 'text' and 'base64' in item.get('text', ''):
                # in case text format
                pass
        print(f'Warning: no image found in response: {content}')
        return False

    def close(self):
        try:
            self.call('finish_working_on_nodes', {})
        except: pass
        self.proc.terminate()
        self.proc.wait()

print("Helper defined successfully.")
