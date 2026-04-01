-- Create password_reset_otps table for custom OTP password reset
CREATE TABLE public.password_reset_otps (
    otp_id serial NOT NULL,
    email character varying(255) NOT NULL,
    otp character varying(6) NOT NULL,
    created_at timestamp without time zone NULL DEFAULT now(),
    expires_at timestamp without time zone NOT NULL,
    used boolean NULL DEFAULT false,
    ip_address character varying(45) NULL,
    user_agent text NULL,
    CONSTRAINT password_reset_otps_pkey PRIMARY KEY (otp_id)
) TABLESPACE pg_default;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_email 
    ON public.password_reset_otps USING btree (email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_password_reset_otp 
    ON public.password_reset_otps USING btree (otp) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_password_reset_expires 
    ON public.password_reset_otps USING btree (expires_at) TABLESPACE pg_default;

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can manage OTPs"
    ON public.password_reset_otps
    FOR ALL
    TO service_role
    USING (true);

-- Function to cleanup expired OTPs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.password_reset_otps
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- Comment on table
COMMENT ON TABLE public.password_reset_otps IS 'Stores OTP codes for password reset requests with expiry, one-time use flag, and security audit fields';
