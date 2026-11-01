import { useStore } from '../context/StoreContext.jsx';
import { useBodyLock } from '../hooks/useBodyLock.js';
import BackToTop from './BackToTop.jsx';
import CartPanel from './CartPanel.jsx';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import ScrollManager from './ScrollManager.jsx';
import ToastStack from './ToastStack.jsx';
import WishlistPanel from './WishlistPanel.jsx';

export default function Layout({ children }) {
  const { panel } = useStore();
  useBodyLock(panel !== null);

  return (
    <>
      <ScrollManager />
      <Header />
      <main>{children}</main>
      <Footer />
      <CartPanel />
      <WishlistPanel />
      <ToastStack />
      <BackToTop />
    </>
  );
}
