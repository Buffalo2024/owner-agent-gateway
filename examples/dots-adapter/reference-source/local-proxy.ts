// Historical deployed bridge reference; see ../README.md for dependencies and limits.
import { request as connectRequest } from 'node:http';
import { Agent, request } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { resolve4 } from 'node:dns/promises';
import { validatePublicUrl, type PublicTransport } from '../../protocol-adapters/src/public-http.ts';

// Only the explicitly configured local proxy receives callback traffic. Pin the
// CONNECT destination to a checked public address while retaining TLS SNI.
export function localProxyTransport(proxyUri: string): PublicTransport {
  const proxy = new URL(proxyUri);
  if (proxy.protocol !== 'http:' || proxy.hostname !== '127.0.0.1' || !proxy.port ||
      proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash)
    throw Error('LOCAL_PROXY_CONFIG_INVALID');
  return async (uri, options = {}) => {
    const target = validatePublicUrl(uri);
    const addresses = await Promise.race([resolve4(target.hostname), new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(Error('PROTOCOL_DNS_TIMEOUT')), 5000); timer.unref();
    })]);
    if (!addresses.length) throw Error('PROTOCOL_DNS_INVALID');
    for (const address of addresses) validatePublicUrl(`https://${address}/`);
    if (options.body && Buffer.byteLength(options.body) > 262144)
      throw Error('PROTOCOL_REQUEST_TOO_LARGE');
    return new Promise((resolve, reject) => {
      let tunnel: ReturnType<typeof tlsConnect> | undefined;
      let outgoing: ReturnType<typeof request> | undefined;
      const agent = new Agent({ keepAlive: false });
      const fail = (error: Error) => {
        clearTimeout(timer); opening.destroy(); outgoing?.destroy(); tunnel?.destroy(); agent.destroy(); reject(error);
      };
      const opening = connectRequest({ hostname: proxy.hostname, port: proxy.port,
        method: 'CONNECT', path: `${addresses[0]}:443`, headers: { host: `${addresses[0]}:443` } });
      const timer = setTimeout(() => fail(Error('PROTOCOL_ENDPOINT_TIMEOUT')), 15000);
      opening.once('error', fail);
      opening.once('response', () => fail(Error('LOCAL_PROXY_CONNECT_REJECTED')));
      opening.once('connect', (response, socket, head) => {
        if (response.statusCode !== 200 || head.length) {
          socket.destroy(); fail(Error('LOCAL_PROXY_CONNECT_REJECTED')); return;
        }
        tunnel = tlsConnect({ socket, servername: target.hostname, rejectUnauthorized: true });
        tunnel.once('error', fail);
        tunnel.once('secureConnect', () => {
          agent.createConnection = () => tunnel!;
          outgoing = request(target, { agent, method: options.method ?? 'GET',
            headers: { accept: 'application/json', ...options.headers } }, result => {
            const chunks: Buffer[] = []; let bytes = 0;
            result.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > 1048576) fail(Error('PROTOCOL_RESPONSE_TOO_LARGE'));
              else chunks.push(chunk);
            });
            result.once('error', fail);
            result.once('aborted', () => fail(Error('PROTOCOL_RESPONSE_ABORTED')));
            result.once('end', () => {
              clearTimeout(timer); agent.destroy();
              resolve({ status: result.statusCode ?? 0,
                headers: Object.fromEntries(Object.entries(result.headers).map(([k,v]) => [k, Array.isArray(v) ? v.join(',') : v ?? ''])),
                text: Buffer.concat(chunks).toString('utf8') });
            });
          });
          outgoing.once('error', fail); outgoing.end(options.body);
        });
      });
      opening.end();
    });
  };
}
