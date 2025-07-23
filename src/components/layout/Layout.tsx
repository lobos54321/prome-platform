import { ReactNode } from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <footer className="py-4 px-6 border-t">
        <div className="container mx-auto text-center text-sm text-gray-500">
          © {new Date().getFullYear()} ProMe • Feed your feed to your AI, and let it feed you
        </div>
      </footer>
    </div>
  );
}