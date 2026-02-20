router.post('/login', async (req,res)=>{
  try{

    const parsed = loginSchema.safeParse(req.body);
    if(!parsed.success){
      return res.status(400).json({
        ok:false,
        error:'bad_request',
        details: parsed.error.flatten()
      });
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if(!user){
      return res.status(401).json({ ok:false, error:'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok){
      return res.status(401).json({ ok:false, error:'invalid_credentials' });
    }

    const lic = await findLicenseById(user.license_id);
    if(!lic){
      return res.status(401).json({ ok:false, error:'license_not_found' });
    }

    if(new Date(lic.expires_at).getTime() < Date.now()){
      return res.status(403).json({ ok:false, error:'license_expired' });
    }

    const token = jwt.sign(
      {
        uid: user.id,
        email: user.email,
        role: user.role,
        licenseId: lic.id,
        plan: lic.plan
      },
      requireEnv('JWT_SECRET'),
      { expiresIn: '12h' }
    );

    return res.json({
      ok:true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name || ''
      },
      license: {
        id: lic.id,
        plan: lic.plan,
        expiresAt: lic.expires_at,
        maxUsers: lic.max_users
      }
    });

  }catch(err){
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});
