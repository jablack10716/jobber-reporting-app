import appLogo from "assets/images/app-logo-placeholder.svg";
import AppFrame from "components/AppFrame";
import AuthHandler from "components/AuthHandler";
import { useUserContext } from "contexts";
import Auth from "pages/Auth";
import Home from "pages/Home/Home";
import Reports from "pages/Reports/Reports";
import PlumberReport from "pages/Reports/PlumberReport";
import CombinedReport from "pages/Reports/CombinedReport";
import {
  Navigate,
  Outlet,
  Route,
  Routes as ReactRouterRoutes,
} from "react-router-dom";

const Routes = () => {
  return (
    <ReactRouterRoutes>
      <Route element={<ProtectedRoutes />}>
        <Route element={<AppFrame logo={appLogo} />}>
          <Route index element={<Navigate to="home" />} />
          <Route path="home" element={<Home />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/combined" element={<CombinedReport />} />
          <Route path="reports/lorin" element={<PlumberReport plumber="Lorin" />} />
          <Route path="reports/wes" element={<PlumberReport plumber="Wes" />} />
          <Route path="reports/elijah" element={<PlumberReport plumber="Elijah" />} />
          {/* Direct routes for convenience */}
          <Route path="lorin" element={<PlumberReport plumber="Lorin" />} />
          <Route path="wes" element={<PlumberReport plumber="Wes" />} />
          <Route path="elijah" element={<PlumberReport plumber="Elijah" />} />
        </Route>
      </Route>
      <Route path="auth" element={<Auth />} />
      <Route path="auth/callback" element={<AuthHandler />} />
    </ReactRouterRoutes>
  );
};

const ProtectedRoutes = () => {
  const { user } = useUserContext();
  
  // Require authentication: if no accountName in user context, send to /auth
  if (!user.accountName) {
    return <Navigate to="/auth" />;
  }

  return <Outlet />;
};

export default Routes;
