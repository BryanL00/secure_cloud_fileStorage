--
-- PostgreSQL database dump
--

\restrict aScDbYf2NfEFGaedNPCgfLGZHT6jNWCQLC9kToKgLE4aNjkSSJQ1NtNNV7kVp5P

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'USER',
    'GUEST'
);


--
-- Name: trigger_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email character varying(255),
    user_role character varying(50),
    action character varying(100) NOT NULL,
    resource character varying(100),
    resource_id uuid,
    details text,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_encryption_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_encryption_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    encrypted_aes_key text NOT NULL,
    aes_iv character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    granted_to_user_id uuid NOT NULL,
    granted_by_user_id uuid NOT NULL,
    permission_level character varying(20) DEFAULT 'viewer'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_permission_level CHECK (((permission_level)::text = ANY ((ARRAY['viewer'::character varying, 'metadata'::character varying])::text[])))
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_key character varying(512) NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    mime_type character varying(127),
    sensitivity_level character varying(20) DEFAULT 'low'::character varying NOT NULL,
    project_category character varying(100),
    is_deleted boolean DEFAULT false NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id uuid,
    department character varying(100),
    CONSTRAINT chk_file_size CHECK ((size_bytes >= 0)),
    CONSTRAINT chk_sensitivity CHECK (((sensitivity_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'confidential'::character varying])::text[])))
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department character varying(100),
    managed_project character varying(255)
);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: file_encryption_keys file_encryption_keys_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_encryption_keys
    ADD CONSTRAINT file_encryption_keys_file_id_key UNIQUE (file_id);


--
-- Name: file_encryption_keys file_encryption_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_encryption_keys
    ADD CONSTRAINT file_encryption_keys_pkey PRIMARY KEY (id);


--
-- Name: file_permissions file_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_permissions
    ADD CONSTRAINT file_permissions_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: files files_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_storage_key_key UNIQUE (storage_key);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: file_permissions uq_file_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_permissions
    ADD CONSTRAINT uq_file_permission UNIQUE (file_id, granted_to_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_file_encryption_keys_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_encryption_keys_file_id ON public.file_encryption_keys USING btree (file_id);


--
-- Name: idx_file_permissions_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_permissions_file_id ON public.file_permissions USING btree (file_id);


--
-- Name: idx_file_permissions_granted_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_permissions_granted_by_user_id ON public.file_permissions USING btree (granted_by_user_id);


--
-- Name: idx_file_permissions_granted_to_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_permissions_granted_to_user_id ON public.file_permissions USING btree (granted_to_user_id);


--
-- Name: idx_files_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_is_deleted ON public.files USING btree (is_deleted);


--
-- Name: idx_files_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_owner_id ON public.files USING btree (owner_id);


--
-- Name: idx_files_sensitivity_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_sensitivity_level ON public.files USING btree (sensitivity_level);


--
-- Name: idx_folders_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folders_owner_id ON public.folders USING btree (owner_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: files set_updated_at_files; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_files BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: users set_updated_at_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: file_encryption_keys file_encryption_keys_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_encryption_keys
    ADD CONSTRAINT file_encryption_keys_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_permissions file_permissions_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_permissions
    ADD CONSTRAINT file_permissions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_permissions file_permissions_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_permissions
    ADD CONSTRAINT file_permissions_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: file_permissions file_permissions_granted_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_permissions
    ADD CONSTRAINT file_permissions_granted_to_user_id_fkey FOREIGN KEY (granted_to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: files files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: files files_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folders folders_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict aScDbYf2NfEFGaedNPCgfLGZHT6jNWCQLC9kToKgLE4aNjkSSJQ1NtNNV7kVp5P



--
-- Seed data required for the application to run
-- (Roles are mandatory; the app JOINs users -> roles on every login.)
--

INSERT INTO public.roles (id, name, description) VALUES
    (1, 'Administrator',      'Manages users, departments, tags and views audit logs. No file access.'),
    (2, 'Department Manager', 'Uploads, downloads and shares files within same department only.'),
    (3, 'Project Manager',    'Uploads, downloads and shares files within same project scope only.'),
    (4, 'User',               'Uploads and downloads own files only.'),
    (5, 'Guest',              'Views and downloads explicitly shared low-sensitivity files only.')
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.roles_id_seq', (SELECT MAX(id) FROM public.roles));

--
-- Default administrator account for first login.
--   Email:    admin@test.com
--   Password: Admin@1234
-- Change or remove this account after first login.
--
INSERT INTO public.users (email, password_hash, full_name, role_id, department)
VALUES (
    'admin@test.com',
    '$2a$12$3KeA4yx9eEoTwE9huwZSs.pxk4Vo8CWv4Sy/nkkjwopMkmJn14zxG',
    'System Administrator',
    1,
    NULL
)
ON CONFLICT (email) DO NOTHING;
