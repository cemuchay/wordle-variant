import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

export const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-sm w-full">
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-center">Join the Ranks</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          onlyThirdPartyProviders
          redirectTo={window.location.origin}
        />
        <button onClick={onClose} className="mt-4 w-full text-gray-500 text-xs uppercase">Cancel</button>
      </div>
    </div>
  );
};