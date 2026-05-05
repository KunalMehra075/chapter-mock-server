import { Router } from 'express';
import { handleEmail } from '../controllers/emailController.js';

const router = Router();

router.post('/api/email', handleEmail);

export default router;

