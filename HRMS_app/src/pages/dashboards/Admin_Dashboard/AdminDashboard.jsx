import DashboardLayout from "../../../layouts/DashboardLayout";
import { NAVIGATION } from "../../../config/navigation";

const AdminDashboard = () => <DashboardLayout navigation={NAVIGATION.admin} defaultPage="home" />;

export default AdminDashboard;
