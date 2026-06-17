import { signOut } from "@/app/actions";
import { btn } from "@/components/ui/kit";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className={`${btn.secondary} px-3 py-1.5 text-sm`}>
        Esci
      </button>
    </form>
  );
}
