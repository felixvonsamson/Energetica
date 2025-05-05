import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import SignInPage from "./pages/SignIn.tsx";
import {BrowserRouter, Routes, Route} from "react-router";
import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
    throw new Error("Root element not found");
}

createRoot(rootEl).render(<StrictMode>
    <script src="http://localhost:8097"></script>
    <BrowserRouter>
        <Routes>
            <Route path="/signin" element={<SignInPage/>}/>
        </Routes>
    </BrowserRouter>
</StrictMode>);
