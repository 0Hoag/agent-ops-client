import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production worker log proxy', () => {
  it('adapts only worker log upgrades without overriding an explicit Authorization header', () => {
    const config = readFileSync('docker/nginx.conf.template', 'utf8');
    expect(config).toContain('map "$uri:$http_upgrade:$http_authorization" $worker_authorization');
    expect(config).toContain('default $http_authorization;');
    expect(config).toContain('~*^/api/v1/workers/[^/]+/logs:websocket:$ "Bearer $arg_access_token";');
    expect(config).toContain('proxy_set_header Authorization $worker_authorization;');
  });
});
