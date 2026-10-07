import type { Metadata } from 'next';
import { LoginForm } from './login-form';
export const metadata: Metadata = { title: 'ورود' };
export default function LoginPage() { return <section className="auth-shell"><LoginForm /></section>; }
