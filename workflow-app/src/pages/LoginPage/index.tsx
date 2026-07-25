import { LoginForm } from "@/components/login-form"
import { AnimatePresence, motion } from "framer-motion"
import { useAuth } from "@/context/auth/authContext"
export default function LoginPage() {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="login"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <LoginForm />
      </motion.div>
    </AnimatePresence>
  )
}
