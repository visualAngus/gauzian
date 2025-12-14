--
-- PostgreSQL database dump
--

\restrict DpIRztBZqinGJeiJ7DDuUH8SYtiMgjae7XNIh5CHqALn4hy4JLv48hwM3jLRpHu

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: file_access; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.file_access (
    user_id uuid NOT NULL,
    file_id uuid NOT NULL,
    encrypted_file_key bytea NOT NULL,
    permission_level character varying(20) DEFAULT 'editor'::character varying,
    joined_at timestamp with time zone DEFAULT now(),
    folder_id uuid
);


ALTER TABLE public.file_access OWNER TO gauzian_user;

--
-- Name: folder_access; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.folder_access (
    user_id uuid NOT NULL,
    folder_id uuid NOT NULL,
    encrypted_folder_key bytea NOT NULL,
    permission_level character varying(20) DEFAULT 'editor'::character varying
);


ALTER TABLE public.folder_access OWNER TO gauzian_user;

--
-- Name: folders; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    parent_id uuid,
    encrypted_metadata bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_root boolean DEFAULT false NOT NULL
);


ALTER TABLE public.folders OWNER TO gauzian_user;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.sessions (
    token character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    ip_address character varying,
    user_agent text
);


ALTER TABLE public.sessions OWNER TO gauzian_user;

--
-- Name: streaming_file; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.streaming_file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    folder_id uuid,
    encrypted_metadata bytea,
    media_type text,
    file_size bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    encrypted_file_key text
);


ALTER TABLE public.streaming_file OWNER TO gauzian_user;

--
-- Name: streaming_file_chunks; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.streaming_file_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temp_upload_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    encrypted_chunk bytea NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.streaming_file_chunks OWNER TO gauzian_user;

--
-- Name: tmp_share; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.tmp_share (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission_level text DEFAULT 'read'::text NOT NULL,
    encrypted_file_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT chk_permission CHECK ((permission_level = ANY (ARRAY['read'::text, 'write'::text, 'admin'::text])))
);


ALTER TABLE public.tmp_share OWNER TO gauzian_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash bytea NOT NULL,
    salt_e2e bytea NOT NULL,
    salt_auth bytea NOT NULL,
    storage_key_encrypted bytea NOT NULL,
    storage_key_encrypted_recuperation bytea NOT NULL,
    last_name text,
    first_name text,
    date_of_birth date,
    time_zone text,
    locale text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO gauzian_user;

--
-- Name: vault_files; Type: TABLE; Schema: public; Owner: gauzian_user
--

CREATE TABLE public.vault_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    encrypted_blob bytea,
    encrypted_metadata bytea NOT NULL,
    media_type character varying(255),
    file_size bigint NOT NULL,
    is_shared boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_compressed boolean DEFAULT false,
    folder_id uuid,
    streaming_upload_id uuid,
    is_chunked boolean DEFAULT false
);


ALTER TABLE public.vault_files OWNER TO gauzian_user;

--
-- Data for Name: file_access; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.file_access (user_id, file_id, encrypted_file_key, permission_level, joined_at, folder_id) FROM stdin;
\.


--
-- Data for Name: folder_access; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.folder_access (user_id, folder_id, encrypted_folder_key, permission_level) FROM stdin;
\.


--
-- Data for Name: folders; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.folders (id, owner_id, parent_id, encrypted_metadata, created_at, updated_at, is_root) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.sessions (token, user_id, created_at, expires_at, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: streaming_file; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.streaming_file (id, owner_id, folder_id, encrypted_metadata, media_type, file_size, created_at, encrypted_file_key) FROM stdin;
\.


--
-- Data for Name: streaming_file_chunks; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.streaming_file_chunks (id, temp_upload_id, chunk_index, encrypted_chunk, uploaded_at) FROM stdin;
\.


--
-- Data for Name: tmp_share; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.tmp_share (id, file_id, user_id, permission_level, encrypted_file_key, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.users (id, email, password_hash, salt_e2e, salt_auth, storage_key_encrypted, storage_key_encrypted_recuperation, last_name, first_name, date_of_birth, time_zone, locale, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vault_files; Type: TABLE DATA; Schema: public; Owner: gauzian_user
--

COPY public.vault_files (id, owner_id, encrypted_blob, encrypted_metadata, media_type, file_size, is_shared, created_at, updated_at, is_compressed, folder_id, streaming_upload_id, is_chunked) FROM stdin;
\.


--
-- Name: file_access file_access_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.file_access
    ADD CONSTRAINT file_access_pkey PRIMARY KEY (user_id, file_id);


--
-- Name: folder_access folder_access_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folder_access
    ADD CONSTRAINT folder_access_pkey PRIMARY KEY (user_id, folder_id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);


--
-- Name: streaming_file_chunks streaming_file_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file_chunks
    ADD CONSTRAINT streaming_file_chunks_pkey PRIMARY KEY (id);


--
-- Name: streaming_file streaming_file_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file
    ADD CONSTRAINT streaming_file_pkey PRIMARY KEY (id);


--
-- Name: tmp_share tmp_share_file_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.tmp_share
    ADD CONSTRAINT tmp_share_file_id_user_id_key UNIQUE (file_id, user_id);


--
-- Name: tmp_share tmp_share_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.tmp_share
    ADD CONSTRAINT tmp_share_pkey PRIMARY KEY (id);


--
-- Name: streaming_file_chunks unique_chunk_per_upload; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file_chunks
    ADD CONSTRAINT unique_chunk_per_upload UNIQUE (temp_upload_id, chunk_index);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vault_files vault_files_pkey; Type: CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_pkey PRIMARY KEY (id);


--
-- Name: idx_access_user; Type: INDEX; Schema: public; Owner: gauzian_user
--

CREATE INDEX idx_access_user ON public.file_access USING btree (user_id);


--
-- Name: idx_folders_owner; Type: INDEX; Schema: public; Owner: gauzian_user
--

CREATE INDEX idx_folders_owner ON public.folders USING btree (owner_id);


--
-- Name: idx_folders_parent; Type: INDEX; Schema: public; Owner: gauzian_user
--

CREATE INDEX idx_folders_parent ON public.folders USING btree (parent_id);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: gauzian_user
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: file_access file_access_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.file_access
    ADD CONSTRAINT file_access_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.vault_files(id) ON DELETE CASCADE;


--
-- Name: file_access file_access_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.file_access
    ADD CONSTRAINT file_access_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id);


--
-- Name: file_access file_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.file_access
    ADD CONSTRAINT file_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folder_access folder_access_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folder_access
    ADD CONSTRAINT folder_access_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folder_access folder_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folder_access
    ADD CONSTRAINT folder_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folders folders_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: streaming_file_chunks streaming_file_chunks_temp_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file_chunks
    ADD CONSTRAINT streaming_file_chunks_temp_upload_id_fkey FOREIGN KEY (temp_upload_id) REFERENCES public.streaming_file(id) ON DELETE CASCADE;


--
-- Name: streaming_file streaming_file_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file
    ADD CONSTRAINT streaming_file_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: streaming_file streaming_file_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.streaming_file
    ADD CONSTRAINT streaming_file_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tmp_share tmp_share_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.tmp_share
    ADD CONSTRAINT tmp_share_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.vault_files(id) ON DELETE CASCADE;


--
-- Name: tmp_share tmp_share_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.tmp_share
    ADD CONSTRAINT tmp_share_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vault_files vault_files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: vault_files vault_files_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vault_files vault_files_streaming_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gauzian_user
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_streaming_upload_id_fkey FOREIGN KEY (streaming_upload_id) REFERENCES public.streaming_file(id);


--
-- PostgreSQL database dump complete
--

\unrestrict DpIRztBZqinGJeiJ7DDuUH8SYtiMgjae7XNIh5CHqALn4hy4JLv48hwM3jLRpHu

