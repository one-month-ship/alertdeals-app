import { jwtDecode, JwtPayload } from 'jwt-decode';

export function decode(accessToken: string) {
  try {
    return jwtDecode<JwtPayload & { role: string }>(accessToken);
  } catch {
    return { role: 'anon' } as JwtPayload & { role: string };
  }
}
