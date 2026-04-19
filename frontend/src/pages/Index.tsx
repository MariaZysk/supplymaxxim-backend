import { Navigate } from "react-router-dom";

// Index now serves as the entry — redirect to Login.
const Index = () => <Navigate to="/login" replace />;

export default Index;
