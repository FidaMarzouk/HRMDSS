import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Power } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const RoboticLogoutModal = ({ isOpen, onCancel }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      navigate('/', { replace: true });
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onCancel}>
      <AlertDialogContent className="bg-sunk border-2 border-line p-0 overflow-hidden w-full max-w-md sm:max-w-lg md:max-w-xl">
        {/* Decorative circuit lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-teal" />
          <div className="absolute top-0 right-0 w-20 h-20 border-r-2 border-t-2 border-teal" />
          <div className="absolute bottom-0 left-0 w-20 h-20 border-l-2 border-b-2 border-teal" />
          <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-teal" />
        </div>

        <AlertDialogHeader className="p-8 space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-1.5 bg-teal rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-sunk rounded-full p-5 border-2 border-teal">
                <Power className="w-10 h-10 text-teal" />
              </div>
            </div>
          </div>

          <AlertDialogTitle className="text-3xl font-bold text-center text-ink">
            Log out?
          </AlertDialogTitle>

          <AlertDialogDescription className="text-center text-ink space-y-3">
            <span className="block text-base opacity-80">
              This will end your current session and return you to the login page.
              Any unsaved changes will be lost.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-sunk p-6">
          <AlertDialogFooter className="flex space-x-6">
            <AlertDialogCancel
              onClick={onCancel}
              className="flex-1 bg-transparent border-2 border-line-2 text-ink hover:bg-sunk hover:text-ink py-3 text-lg"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleLogout}
              className="flex-1 bg-teal hover:bg-teal-hi text-on-accent border-2 border-teal py-3 text-lg"
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RoboticLogoutModal;
