-- db/baseline.sql
-- Skema lengkap (hasil pg_dump dari DB yang sudah termigrasi penuh) untuk deploy FRESH.
-- migrate-runner memakai berkas ini HANYA bila database kosong, lalu menandai
-- semua migrasi lama sebagai sudah diterapkan. JANGAN jalankan manual pada DB berisi.

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absensi_perizinan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absensi_perizinan (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    tanggal date NOT NULL,
    is_alpha boolean DEFAULT false,
    keterangan text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    pengajar_id integer,
    sesi_id integer,
    status character varying(10),
    CONSTRAINT absensi_perizinan_status_check CHECK (((status IS NULL) OR ((status)::text = ANY ((ARRAY['izin'::character varying, 'sakit'::character varying, 'alpha'::character varying])::text[]))))
);


--
-- Name: absensi_perizinan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absensi_perizinan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absensi_perizinan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absensi_perizinan_id_seq OWNED BY public.absensi_perizinan.id;


--
-- Name: absensi_sesi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absensi_sesi (
    id integer NOT NULL,
    bagian_id integer NOT NULL,
    jadwal_id integer,
    mapel_id integer,
    pengajar_id integer,
    tanggal date NOT NULL,
    pertemuan integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT absensi_sesi_pertemuan_check CHECK (((pertemuan >= 1) AND (pertemuan <= 2)))
);


--
-- Name: absensi_sesi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absensi_sesi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absensi_sesi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absensi_sesi_id_seq OWNED BY public.absensi_sesi.id;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(50) NOT NULL,
    target character varying(100),
    target_id integer,
    detail jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;


--
-- Name: agenda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda (
    id integer NOT NULL,
    judul text NOT NULL,
    deskripsi text,
    tgl_mulai date NOT NULL,
    tgl_selesai date,
    dibuat_oleh integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agenda_tgl_valid CHECK (((tgl_selesai IS NULL) OR (tgl_selesai >= tgl_mulai)))
);


--
-- Name: agenda_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_id_seq OWNED BY public.agenda.id;


--
-- Name: alumni; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alumni (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    tahun_lulus character varying(9),
    khidmah character varying(50) DEFAULT 'belum'::character varying,
    status_ijazah character varying(50) DEFAULT 'belum'::character varying,
    extra jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    no_ijazah character varying(100)
);


--
-- Name: alumni_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alumni_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alumni_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alumni_id_seq OWNED BY public.alumni.id;


--
-- Name: bagian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bagian (
    id integer NOT NULL,
    kelas_id integer NOT NULL,
    tingkatan_id integer NOT NULL,
    nama_bagian character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bagian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bagian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bagian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bagian_id_seq OWNED BY public.bagian.id;


--
-- Name: catatan_santri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catatan_santri (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    jenis character varying(12) NOT NULL,
    tanggal date NOT NULL,
    kategori character varying(120),
    deskripsi text NOT NULL,
    tahun_ajaran character varying(9),
    pengajar_id integer,
    user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catatan_santri_jenis_check CHECK (((jenis)::text = ANY ((ARRAY['pelanggaran'::character varying, 'prestasi'::character varying])::text[])))
);


--
-- Name: catatan_santri_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catatan_santri_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catatan_santri_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catatan_santri_id_seq OWNED BY public.catatan_santri.id;


--
-- Name: dewan_harian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dewan_harian (
    id integer NOT NULL,
    nama character varying(255) NOT NULL,
    nama_wali character varying(255),
    ttl_tempat character varying(255),
    ttl_tanggal date,
    alamat text,
    no_hp character varying(20),
    jabatan character varying(255) NOT NULL,
    lembaga character varying(50) NOT NULL,
    tahun_aktif character varying(9) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    extra jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dewan_harian_lembaga_check CHECK (((lembaga)::text = ANY ((ARRAY['P3HM'::character varying, 'MPHM'::character varying, 'M3PHM'::character varying])::text[])))
);


--
-- Name: dewan_harian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dewan_harian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dewan_harian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dewan_harian_id_seq OWNED BY public.dewan_harian.id;


--
-- Name: dynamic_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_columns (
    id integer NOT NULL,
    target_table character varying(50) NOT NULL,
    column_key character varying(255) NOT NULL,
    column_label character varying(255) NOT NULL,
    column_type character varying(50) NOT NULL,
    select_options jsonb,
    is_required boolean DEFAULT false NOT NULL,
    urutan integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dynamic_columns_column_type_check CHECK (((column_type)::text = ANY ((ARRAY['text'::character varying, 'number'::character varying, 'date'::character varying, 'select'::character varying, 'textarea'::character varying])::text[]))),
    CONSTRAINT dynamic_columns_target_table_check CHECK (((target_table)::text = ANY ((ARRAY['santri'::character varying, 'alumni'::character varying, 'pengajar'::character varying, 'dewan_harian'::character varying])::text[])))
);


--
-- Name: dynamic_columns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dynamic_columns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dynamic_columns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dynamic_columns_id_seq OWNED BY public.dynamic_columns.id;


--
-- Name: jadwal_pelajaran; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jadwal_pelajaran (
    id integer NOT NULL,
    bagian_id integer NOT NULL,
    mapel_id integer NOT NULL,
    pengajar_id integer,
    hari character varying(20) NOT NULL,
    jam_mulai time without time zone NOT NULL,
    jam_selesai time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: jadwal_pelajaran_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jadwal_pelajaran_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jadwal_pelajaran_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jadwal_pelajaran_id_seq OWNED BY public.jadwal_pelajaran.id;


--
-- Name: kalender_kuartal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kalender_kuartal (
    id integer NOT NULL,
    kuartal integer NOT NULL,
    tahun_ajaran character varying(9) NOT NULL,
    tgl_mulai date NOT NULL,
    tgl_selesai date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kalender_kuartal_kuartal_check CHECK ((kuartal = ANY (ARRAY[1, 2, 3, 4])))
);


--
-- Name: kalender_kuartal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kalender_kuartal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kalender_kuartal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kalender_kuartal_id_seq OWNED BY public.kalender_kuartal.id;


--
-- Name: kelas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kelas (
    id integer NOT NULL,
    nama character varying(255) NOT NULL,
    tahun_masuk character varying(9) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kelas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kelas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kelas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kelas_id_seq OWNED BY public.kelas.id;


--
-- Name: mata_pelajaran; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mata_pelajaran (
    id integer NOT NULL,
    nama_mapel character varying(255) NOT NULL,
    urutan integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    kategori character varying(50) DEFAULT 'umum'::character varying,
    kelas_id integer,
    tingkatan_id integer,
    nama_kitab character varying(255),
    CONSTRAINT mata_pelajaran_kategori_check CHECK (((kategori)::text = ANY ((ARRAY['al_quran'::character varying, 'al_khot_imla'::character varying, 'qiroah_kutub'::character varying, 'muhafadhoh'::character varying, 'akhlaq'::character varying, 'akhlaq_perilaku'::character varying, 'umum'::character varying])::text[])))
);


--
-- Name: mata_pelajaran_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mata_pelajaran_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mata_pelajaran_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mata_pelajaran_id_seq OWNED BY public.mata_pelajaran.id;


--
-- Name: mudir_tingkatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mudir_tingkatan (
    id integer NOT NULL,
    tingkatan_id integer NOT NULL,
    nama_mudir character varying(255) NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tanda_tangan text
);


--
-- Name: mudir_tingkatan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mudir_tingkatan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mudir_tingkatan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mudir_tingkatan_id_seq OWNED BY public.mudir_tingkatan.id;


--
-- Name: mufatish_tingkatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mufatish_tingkatan (
    id integer NOT NULL,
    tingkatan_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pengajar_id integer,
    user_id integer,
    tahun_ajaran character varying(9)
);


--
-- Name: mufatish_tingkatan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mufatish_tingkatan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mufatish_tingkatan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mufatish_tingkatan_id_seq OWNED BY public.mufatish_tingkatan.id;


--
-- Name: mustahiq_bagian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mustahiq_bagian (
    id integer NOT NULL,
    bagian_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pengajar_id integer,
    user_id integer,
    tahun_ajaran character varying(9)
);


--
-- Name: mustahiq_bagian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mustahiq_bagian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mustahiq_bagian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mustahiq_bagian_id_seq OWNED BY public.mustahiq_bagian.id;


--
-- Name: nilai_am; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nilai_am (
    id integer NOT NULL,
    santri_id integer,
    bagian_id integer NOT NULL,
    semester integer NOT NULL,
    nilai_am numeric(4,2),
    is_edited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    mapel_id integer,
    tahun_ajaran character varying(9) NOT NULL,
    CONSTRAINT nilai_am_semester_check CHECK ((semester = ANY (ARRAY[1, 2])))
);


--
-- Name: nilai_am_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nilai_am_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nilai_am_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nilai_am_id_seq OWNED BY public.nilai_am.id;


--
-- Name: nilai_bayan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nilai_bayan (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    bagian_id integer NOT NULL,
    tahun_ajaran character varying(9) NOT NULL,
    kategori_id integer NOT NULL,
    label_arab character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    nilai_angka integer,
    nilai_label character varying(100)
);


--
-- Name: nilai_bayan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nilai_bayan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nilai_bayan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nilai_bayan_id_seq OWNED BY public.nilai_bayan.id;


--
-- Name: nilai_khos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nilai_khos (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    mapel_id integer NOT NULL,
    semester integer NOT NULL,
    nilai_akhir numeric(4,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tahun_ajaran character varying(9),
    CONSTRAINT nilai_khos_semester_check CHECK ((semester = ANY (ARRAY[1, 2])))
);


--
-- Name: nilai_khos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nilai_khos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nilai_khos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nilai_khos_id_seq OWNED BY public.nilai_khos.id;


--
-- Name: nilai_kuartal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nilai_kuartal (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    mapel_id integer NOT NULL,
    kuartal integer NOT NULL,
    nilai numeric(4,2),
    is_her boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tahun_ajaran character varying(9) NOT NULL,
    CONSTRAINT nilai_kuartal_kuartal_check CHECK ((kuartal = ANY (ARRAY[1, 2, 3, 4])))
);


--
-- Name: nilai_kuartal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nilai_kuartal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nilai_kuartal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nilai_kuartal_id_seq OWNED BY public.nilai_kuartal.id;


--
-- Name: pengajar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pengajar (
    id integer NOT NULL,
    nama character varying(255) NOT NULL,
    nama_wali character varying(255),
    ttl_tempat character varying(255),
    ttl_tanggal date,
    alamat text,
    no_hp character varying(20),
    tahun_mengajar character varying(9),
    status character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    extra jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    nama_arab character varying(255)
);


--
-- Name: pengajar_bagian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pengajar_bagian (
    id integer NOT NULL,
    pengajar_id integer NOT NULL,
    bagian_id integer NOT NULL,
    tahun_ajaran character varying(9) NOT NULL,
    peran character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pengajar_bagian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pengajar_bagian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pengajar_bagian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pengajar_bagian_id_seq OWNED BY public.pengajar_bagian.id;


--
-- Name: pengajar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pengajar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pengajar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pengajar_id_seq OWNED BY public.pengajar.id;


--
-- Name: penilaian_konfirmasi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.penilaian_konfirmasi (
    id integer NOT NULL,
    tahun_ajaran character varying(9) NOT NULL,
    semester integer NOT NULL,
    bagian_id integer NOT NULL,
    pengajar_id integer,
    user_id integer,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT penilaian_konfirmasi_semester_check CHECK ((semester = ANY (ARRAY[1, 2])))
);


--
-- Name: penilaian_konfirmasi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.penilaian_konfirmasi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: penilaian_konfirmasi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.penilaian_konfirmasi_id_seq OWNED BY public.penilaian_konfirmasi.id;


--
-- Name: penilaian_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.penilaian_status (
    id integer NOT NULL,
    tahun_ajaran character varying(9) NOT NULL,
    semester integer NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    opened_by integer,
    opened_at timestamp with time zone,
    locked_by integer,
    locked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT penilaian_status_semester_check CHECK ((semester = ANY (ARRAY[1, 2]))),
    CONSTRAINT penilaian_status_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'MASA_KOREKSI'::character varying, 'TERKUNCI'::character varying])::text[])))
);


--
-- Name: penilaian_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.penilaian_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: penilaian_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.penilaian_status_id_seq OWNED BY public.penilaian_status.id;


--
-- Name: proses_keluar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proses_keluar (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    tanggal_keluar date NOT NULL,
    status_keluar character varying(50) NOT NULL,
    alasan text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proses_keluar_status_keluar_check CHECK (((status_keluar)::text = ANY ((ARRAY['lulus'::character varying, 'boyong'::character varying, 'keluar'::character varying])::text[])))
);


--
-- Name: proses_keluar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proses_keluar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proses_keluar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proses_keluar_id_seq OWNED BY public.proses_keluar.id;


--
-- Name: rapot_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rapot_settings (
    id integer NOT NULL,
    header_baris_1 character varying(255),
    header_baris_2 character varying(255),
    header_baris_3 character varying(255),
    nama_kepala character varying(255),
    nip_kepala character varying(255),
    logo_url character varying(255),
    urutan_kolom_identitas jsonb,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rapot_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rapot_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rapot_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rapot_settings_id_seq OWNED BY public.rapot_settings.id;


--
-- Name: rekap_absensi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rekap_absensi (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    kuartal_id integer NOT NULL,
    total_izin integer DEFAULT 0 NOT NULL,
    total_alpha integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    total_sakit integer DEFAULT 0 NOT NULL
);


--
-- Name: rekap_absensi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rekap_absensi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rekap_absensi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rekap_absensi_id_seq OWNED BY public.rekap_absensi.id;


--
-- Name: riwayat_bagian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.riwayat_bagian (
    id integer NOT NULL,
    santri_id integer NOT NULL,
    bagian_id integer NOT NULL,
    tanggal_mulai date NOT NULL,
    tanggal_selesai date,
    keterangan text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: riwayat_bagian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.riwayat_bagian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: riwayat_bagian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.riwayat_bagian_id_seq OWNED BY public.riwayat_bagian.id;


--
-- Name: santri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.santri (
    id integer NOT NULL,
    nik character varying(16) NOT NULL,
    nomor_stambuk character varying(50) NOT NULL,
    nisn character varying(20),
    nama character varying(255) NOT NULL,
    nama_wali character varying(255),
    ttl_tempat character varying(255),
    ttl_tanggal date,
    alamat text,
    no_hp_wali character varying(20),
    bagian_id integer,
    status character varying(50) NOT NULL,
    foto_url character varying(255),
    extra jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    provinsi_kode character varying(2),
    provinsi_nama character varying(255),
    kabupaten_kode character varying(5),
    kabupaten_nama character varying(255),
    kecamatan_kode character varying(8),
    kecamatan_nama character varying(255),
    desa character varying(255),
    khidmah_tempat text,
    khidmah_mulai date,
    khidmah_selesai date,
    nomor_stambuk_urut integer,
    CONSTRAINT santri_status_check CHECK (((status)::text = ANY ((ARRAY['aktif'::character varying, 'cuti'::character varying, 'pengabdian'::character varying, 'lulus'::character varying, 'boyong'::character varying, 'keluar'::character varying])::text[])))
);


--
-- Name: santri_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.santri_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: santri_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.santri_id_seq OWNED BY public.santri.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    user_id integer NOT NULL,
    expired_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: tingkatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tingkatan (
    id integer NOT NULL,
    nama character varying(255) NOT NULL,
    urutan integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tingkatan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tingkatan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tingkatan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tingkatan_id_seq OWNED BY public.tingkatan.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    nama character varying(255) NOT NULL,
    pengajar_id integer,
    is_password_changed boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['pimpinan'::character varying, 'admin'::character varying, 'mufatish'::character varying, 'mustahiq'::character varying, 'munawwib'::character varying, 'pengecekan'::character varying, 'wali_santri'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wali_santri_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wali_santri_link (
    id integer NOT NULL,
    user_id integer NOT NULL,
    santri_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: wali_santri_link_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wali_santri_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wali_santri_link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wali_santri_link_id_seq OWNED BY public.wali_santri_link.id;


--
-- Name: wil_kabupaten; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wil_kabupaten (
    kode character varying(5) NOT NULL,
    provinsi_kode character varying(2) NOT NULL,
    nama character varying(255) NOT NULL
);


--
-- Name: wil_kecamatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wil_kecamatan (
    kode character varying(8) NOT NULL,
    kabupaten_kode character varying(5) NOT NULL,
    nama character varying(255) NOT NULL
);


--
-- Name: wil_provinsi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wil_provinsi (
    kode character varying(2) NOT NULL,
    nama character varying(255) NOT NULL
);


--
-- Name: absensi_perizinan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan ALTER COLUMN id SET DEFAULT nextval('public.absensi_perizinan_id_seq'::regclass);


--
-- Name: absensi_sesi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi ALTER COLUMN id SET DEFAULT nextval('public.absensi_sesi_id_seq'::regclass);


--
-- Name: activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq'::regclass);


--
-- Name: agenda id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda ALTER COLUMN id SET DEFAULT nextval('public.agenda_id_seq'::regclass);


--
-- Name: alumni id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni ALTER COLUMN id SET DEFAULT nextval('public.alumni_id_seq'::regclass);


--
-- Name: bagian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagian ALTER COLUMN id SET DEFAULT nextval('public.bagian_id_seq'::regclass);


--
-- Name: catatan_santri id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catatan_santri ALTER COLUMN id SET DEFAULT nextval('public.catatan_santri_id_seq'::regclass);


--
-- Name: dewan_harian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dewan_harian ALTER COLUMN id SET DEFAULT nextval('public.dewan_harian_id_seq'::regclass);


--
-- Name: dynamic_columns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_columns ALTER COLUMN id SET DEFAULT nextval('public.dynamic_columns_id_seq'::regclass);


--
-- Name: jadwal_pelajaran id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal_pelajaran ALTER COLUMN id SET DEFAULT nextval('public.jadwal_pelajaran_id_seq'::regclass);


--
-- Name: kalender_kuartal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalender_kuartal ALTER COLUMN id SET DEFAULT nextval('public.kalender_kuartal_id_seq'::regclass);


--
-- Name: kelas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelas ALTER COLUMN id SET DEFAULT nextval('public.kelas_id_seq'::regclass);


--
-- Name: mata_pelajaran id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran ALTER COLUMN id SET DEFAULT nextval('public.mata_pelajaran_id_seq'::regclass);


--
-- Name: mudir_tingkatan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mudir_tingkatan ALTER COLUMN id SET DEFAULT nextval('public.mudir_tingkatan_id_seq'::regclass);


--
-- Name: mufatish_tingkatan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan ALTER COLUMN id SET DEFAULT nextval('public.mufatish_tingkatan_id_seq'::regclass);


--
-- Name: mustahiq_bagian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian ALTER COLUMN id SET DEFAULT nextval('public.mustahiq_bagian_id_seq'::regclass);


--
-- Name: nilai_am id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am ALTER COLUMN id SET DEFAULT nextval('public.nilai_am_id_seq'::regclass);


--
-- Name: nilai_bayan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_bayan ALTER COLUMN id SET DEFAULT nextval('public.nilai_bayan_id_seq'::regclass);


--
-- Name: nilai_khos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_khos ALTER COLUMN id SET DEFAULT nextval('public.nilai_khos_id_seq'::regclass);


--
-- Name: nilai_kuartal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_kuartal ALTER COLUMN id SET DEFAULT nextval('public.nilai_kuartal_id_seq'::regclass);


--
-- Name: pengajar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar ALTER COLUMN id SET DEFAULT nextval('public.pengajar_id_seq'::regclass);


--
-- Name: pengajar_bagian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar_bagian ALTER COLUMN id SET DEFAULT nextval('public.pengajar_bagian_id_seq'::regclass);


--
-- Name: penilaian_konfirmasi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi ALTER COLUMN id SET DEFAULT nextval('public.penilaian_konfirmasi_id_seq'::regclass);


--
-- Name: penilaian_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_status ALTER COLUMN id SET DEFAULT nextval('public.penilaian_status_id_seq'::regclass);


--
-- Name: proses_keluar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proses_keluar ALTER COLUMN id SET DEFAULT nextval('public.proses_keluar_id_seq'::regclass);


--
-- Name: rapot_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapot_settings ALTER COLUMN id SET DEFAULT nextval('public.rapot_settings_id_seq'::regclass);


--
-- Name: rekap_absensi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rekap_absensi ALTER COLUMN id SET DEFAULT nextval('public.rekap_absensi_id_seq'::regclass);


--
-- Name: riwayat_bagian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riwayat_bagian ALTER COLUMN id SET DEFAULT nextval('public.riwayat_bagian_id_seq'::regclass);


--
-- Name: santri id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.santri ALTER COLUMN id SET DEFAULT nextval('public.santri_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: tingkatan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tingkatan ALTER COLUMN id SET DEFAULT nextval('public.tingkatan_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wali_santri_link id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wali_santri_link ALTER COLUMN id SET DEFAULT nextval('public.wali_santri_link_id_seq'::regclass);


--
-- Name: absensi_perizinan absensi_perizinan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan
    ADD CONSTRAINT absensi_perizinan_pkey PRIMARY KEY (id);


--
-- Name: absensi_perizinan absensi_perizinan_santri_sesi_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan
    ADD CONSTRAINT absensi_perizinan_santri_sesi_key UNIQUE (santri_id, sesi_id);


--
-- Name: absensi_sesi absensi_sesi_bagian_id_tanggal_pertemuan_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_bagian_id_tanggal_pertemuan_key UNIQUE (bagian_id, tanggal, pertemuan);


--
-- Name: absensi_sesi absensi_sesi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_pkey PRIMARY KEY (id);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: agenda agenda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda
    ADD CONSTRAINT agenda_pkey PRIMARY KEY (id);


--
-- Name: alumni alumni_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_pkey PRIMARY KEY (id);


--
-- Name: alumni alumni_santri_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_santri_id_key UNIQUE (santri_id);


--
-- Name: bagian bagian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagian
    ADD CONSTRAINT bagian_pkey PRIMARY KEY (id);


--
-- Name: catatan_santri catatan_santri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catatan_santri
    ADD CONSTRAINT catatan_santri_pkey PRIMARY KEY (id);


--
-- Name: dewan_harian dewan_harian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dewan_harian
    ADD CONSTRAINT dewan_harian_pkey PRIMARY KEY (id);


--
-- Name: dynamic_columns dynamic_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_columns
    ADD CONSTRAINT dynamic_columns_pkey PRIMARY KEY (id);


--
-- Name: dynamic_columns dynamic_columns_target_table_column_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_columns
    ADD CONSTRAINT dynamic_columns_target_table_column_key_key UNIQUE (target_table, column_key);


--
-- Name: jadwal_pelajaran jadwal_pelajaran_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal_pelajaran
    ADD CONSTRAINT jadwal_pelajaran_pkey PRIMARY KEY (id);


--
-- Name: kalender_kuartal kalender_kuartal_kuartal_tahun_ajaran_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalender_kuartal
    ADD CONSTRAINT kalender_kuartal_kuartal_tahun_ajaran_key UNIQUE (kuartal, tahun_ajaran);


--
-- Name: kalender_kuartal kalender_kuartal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalender_kuartal
    ADD CONSTRAINT kalender_kuartal_pkey PRIMARY KEY (id);


--
-- Name: kelas kelas_nama_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelas
    ADD CONSTRAINT kelas_nama_key UNIQUE (nama);


--
-- Name: kelas kelas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelas
    ADD CONSTRAINT kelas_pkey PRIMARY KEY (id);


--
-- Name: mata_pelajaran mata_pelajaran_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran
    ADD CONSTRAINT mata_pelajaran_pkey PRIMARY KEY (id);


--
-- Name: mudir_tingkatan mudir_tingkatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mudir_tingkatan
    ADD CONSTRAINT mudir_tingkatan_pkey PRIMARY KEY (id);


--
-- Name: mudir_tingkatan mudir_tingkatan_tingkatan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mudir_tingkatan
    ADD CONSTRAINT mudir_tingkatan_tingkatan_id_key UNIQUE (tingkatan_id);


--
-- Name: mufatish_tingkatan mufatish_tingkatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan
    ADD CONSTRAINT mufatish_tingkatan_pkey PRIMARY KEY (id);


--
-- Name: mufatish_tingkatan mufatish_tingkatan_tingkatan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan
    ADD CONSTRAINT mufatish_tingkatan_tingkatan_id_key UNIQUE (tingkatan_id);


--
-- Name: mustahiq_bagian mustahiq_bagian_bagian_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian
    ADD CONSTRAINT mustahiq_bagian_bagian_id_key UNIQUE (bagian_id);


--
-- Name: mustahiq_bagian mustahiq_bagian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian
    ADD CONSTRAINT mustahiq_bagian_pkey PRIMARY KEY (id);


--
-- Name: nilai_am nilai_am_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am
    ADD CONSTRAINT nilai_am_pkey PRIMARY KEY (id);


--
-- Name: nilai_am nilai_am_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am
    ADD CONSTRAINT nilai_am_unique UNIQUE (bagian_id, mapel_id, semester, tahun_ajaran);


--
-- Name: nilai_bayan nilai_bayan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_bayan
    ADD CONSTRAINT nilai_bayan_pkey PRIMARY KEY (id);


--
-- Name: nilai_bayan nilai_bayan_santri_id_bagian_id_tahun_ajaran_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_bayan
    ADD CONSTRAINT nilai_bayan_santri_id_bagian_id_tahun_ajaran_key UNIQUE (santri_id, bagian_id, tahun_ajaran);


--
-- Name: nilai_khos nilai_khos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_khos
    ADD CONSTRAINT nilai_khos_pkey PRIMARY KEY (id);


--
-- Name: nilai_khos nilai_khos_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_khos
    ADD CONSTRAINT nilai_khos_unique UNIQUE (santri_id, mapel_id, semester, tahun_ajaran);


--
-- Name: nilai_kuartal nilai_kuartal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_kuartal
    ADD CONSTRAINT nilai_kuartal_pkey PRIMARY KEY (id);


--
-- Name: nilai_kuartal nilai_kuartal_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_kuartal
    ADD CONSTRAINT nilai_kuartal_unique UNIQUE (santri_id, mapel_id, kuartal, tahun_ajaran);


--
-- Name: pengajar_bagian pengajar_bagian_pengajar_id_bagian_id_tahun_ajaran_peran_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar_bagian
    ADD CONSTRAINT pengajar_bagian_pengajar_id_bagian_id_tahun_ajaran_peran_key UNIQUE (pengajar_id, bagian_id, tahun_ajaran, peran);


--
-- Name: pengajar_bagian pengajar_bagian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar_bagian
    ADD CONSTRAINT pengajar_bagian_pkey PRIMARY KEY (id);


--
-- Name: pengajar pengajar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar
    ADD CONSTRAINT pengajar_pkey PRIMARY KEY (id);


--
-- Name: penilaian_konfirmasi penilaian_konfirmasi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi
    ADD CONSTRAINT penilaian_konfirmasi_pkey PRIMARY KEY (id);


--
-- Name: penilaian_konfirmasi penilaian_konfirmasi_tahun_ajaran_semester_bagian_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi
    ADD CONSTRAINT penilaian_konfirmasi_tahun_ajaran_semester_bagian_id_key UNIQUE (tahun_ajaran, semester, bagian_id);


--
-- Name: penilaian_status penilaian_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_status
    ADD CONSTRAINT penilaian_status_pkey PRIMARY KEY (id);


--
-- Name: penilaian_status penilaian_status_tahun_ajaran_semester_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_status
    ADD CONSTRAINT penilaian_status_tahun_ajaran_semester_key UNIQUE (tahun_ajaran, semester);


--
-- Name: proses_keluar proses_keluar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proses_keluar
    ADD CONSTRAINT proses_keluar_pkey PRIMARY KEY (id);


--
-- Name: rapot_settings rapot_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapot_settings
    ADD CONSTRAINT rapot_settings_pkey PRIMARY KEY (id);


--
-- Name: rekap_absensi rekap_absensi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rekap_absensi
    ADD CONSTRAINT rekap_absensi_pkey PRIMARY KEY (id);


--
-- Name: rekap_absensi rekap_absensi_santri_id_kuartal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rekap_absensi
    ADD CONSTRAINT rekap_absensi_santri_id_kuartal_id_key UNIQUE (santri_id, kuartal_id);


--
-- Name: riwayat_bagian riwayat_bagian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riwayat_bagian
    ADD CONSTRAINT riwayat_bagian_pkey PRIMARY KEY (id);


--
-- Name: santri santri_nik_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.santri
    ADD CONSTRAINT santri_nik_key UNIQUE (nik);


--
-- Name: santri santri_nomor_stambuk_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.santri
    ADD CONSTRAINT santri_nomor_stambuk_key UNIQUE (nomor_stambuk);


--
-- Name: santri santri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.santri
    ADD CONSTRAINT santri_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: tingkatan tingkatan_nama_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tingkatan
    ADD CONSTRAINT tingkatan_nama_key UNIQUE (nama);


--
-- Name: tingkatan tingkatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tingkatan
    ADD CONSTRAINT tingkatan_pkey PRIMARY KEY (id);


--
-- Name: bagian unique_kelas_bagian; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagian
    ADD CONSTRAINT unique_kelas_bagian UNIQUE (tingkatan_id, kelas_id, nama_bagian);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wali_santri_link wali_santri_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wali_santri_link
    ADD CONSTRAINT wali_santri_link_pkey PRIMARY KEY (id);


--
-- Name: wali_santri_link wali_santri_link_user_id_santri_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wali_santri_link
    ADD CONSTRAINT wali_santri_link_user_id_santri_id_key UNIQUE (user_id, santri_id);


--
-- Name: wil_kabupaten wil_kabupaten_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wil_kabupaten
    ADD CONSTRAINT wil_kabupaten_pkey PRIMARY KEY (kode);


--
-- Name: wil_kecamatan wil_kecamatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wil_kecamatan
    ADD CONSTRAINT wil_kecamatan_pkey PRIMARY KEY (kode);


--
-- Name: wil_provinsi wil_provinsi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wil_provinsi
    ADD CONSTRAINT wil_provinsi_pkey PRIMARY KEY (kode);


--
-- Name: idx_absensi_perizinan_santri_tanggal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absensi_perizinan_santri_tanggal ON public.absensi_perizinan USING btree (santri_id, tanggal);


--
-- Name: idx_absensi_sesi_jadwal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absensi_sesi_jadwal ON public.absensi_sesi USING btree (jadwal_id, tanggal);


--
-- Name: idx_absensi_sesi_pengajar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absensi_sesi_pengajar ON public.absensi_sesi USING btree (pengajar_id, tanggal);


--
-- Name: idx_absensi_sesi_tanggal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absensi_sesi_tanggal ON public.absensi_sesi USING btree (tanggal);


--
-- Name: idx_activity_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_action ON public.activity_log USING btree (action);


--
-- Name: idx_activity_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_created ON public.activity_log USING btree (created_at);


--
-- Name: idx_activity_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id);


--
-- Name: idx_agenda_tgl_mulai; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_tgl_mulai ON public.agenda USING btree (tgl_mulai);


--
-- Name: idx_agenda_tgl_selesai; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_tgl_selesai ON public.agenda USING btree (tgl_selesai);


--
-- Name: idx_catatan_santri_jenis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catatan_santri_jenis ON public.catatan_santri USING btree (jenis);


--
-- Name: idx_catatan_santri_santri; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catatan_santri_santri ON public.catatan_santri USING btree (santri_id, tanggal DESC);


--
-- Name: idx_mudir_tingkatan_tingkatan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mudir_tingkatan_tingkatan ON public.mudir_tingkatan USING btree (tingkatan_id);


--
-- Name: idx_penilaian_konfirmasi_ta_smt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_penilaian_konfirmasi_ta_smt ON public.penilaian_konfirmasi USING btree (tahun_ajaran, semester);


--
-- Name: idx_santri_kabupaten; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_santri_kabupaten ON public.santri USING btree (kabupaten_kode);


--
-- Name: idx_santri_provinsi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_santri_provinsi ON public.santri USING btree (provinsi_kode);


--
-- Name: idx_santri_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_santri_status ON public.santri USING btree (status);


--
-- Name: idx_wil_kabupaten_nama; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wil_kabupaten_nama ON public.wil_kabupaten USING btree (lower((nama)::text));


--
-- Name: idx_wil_kabupaten_prov; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wil_kabupaten_prov ON public.wil_kabupaten USING btree (provinsi_kode);


--
-- Name: idx_wil_kecamatan_kab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wil_kecamatan_kab ON public.wil_kecamatan USING btree (kabupaten_kode);


--
-- Name: idx_wil_kecamatan_nama; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wil_kecamatan_nama ON public.wil_kecamatan USING btree (lower((nama)::text));


--
-- Name: idx_wil_provinsi_nama; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wil_provinsi_nama ON public.wil_provinsi USING btree (lower((nama)::text));


--
-- Name: absensi_perizinan absensi_perizinan_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan
    ADD CONSTRAINT absensi_perizinan_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: absensi_perizinan absensi_perizinan_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan
    ADD CONSTRAINT absensi_perizinan_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: absensi_perizinan absensi_perizinan_sesi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_perizinan
    ADD CONSTRAINT absensi_perizinan_sesi_id_fkey FOREIGN KEY (sesi_id) REFERENCES public.absensi_sesi(id) ON DELETE CASCADE;


--
-- Name: absensi_sesi absensi_sesi_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: absensi_sesi absensi_sesi_jadwal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_jadwal_id_fkey FOREIGN KEY (jadwal_id) REFERENCES public.jadwal_pelajaran(id) ON DELETE SET NULL;


--
-- Name: absensi_sesi absensi_sesi_mapel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_mapel_id_fkey FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL;


--
-- Name: absensi_sesi absensi_sesi_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi_sesi
    ADD CONSTRAINT absensi_sesi_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: alumni alumni_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumni
    ADD CONSTRAINT alumni_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: bagian bagian_kelas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagian
    ADD CONSTRAINT bagian_kelas_id_fkey FOREIGN KEY (kelas_id) REFERENCES public.kelas(id);


--
-- Name: bagian bagian_tingkatan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagian
    ADD CONSTRAINT bagian_tingkatan_id_fkey FOREIGN KEY (tingkatan_id) REFERENCES public.tingkatan(id);


--
-- Name: catatan_santri catatan_santri_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catatan_santri
    ADD CONSTRAINT catatan_santri_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: catatan_santri catatan_santri_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catatan_santri
    ADD CONSTRAINT catatan_santri_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: catatan_santri catatan_santri_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catatan_santri
    ADD CONSTRAINT catatan_santri_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_user_pengajar; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_pengajar FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: jadwal_pelajaran jadwal_pelajaran_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal_pelajaran
    ADD CONSTRAINT jadwal_pelajaran_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: jadwal_pelajaran jadwal_pelajaran_mapel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal_pelajaran
    ADD CONSTRAINT jadwal_pelajaran_mapel_id_fkey FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: jadwal_pelajaran jadwal_pelajaran_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal_pelajaran
    ADD CONSTRAINT jadwal_pelajaran_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: mata_pelajaran mata_pelajaran_kelas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran
    ADD CONSTRAINT mata_pelajaran_kelas_id_fkey FOREIGN KEY (kelas_id) REFERENCES public.kelas(id) ON DELETE CASCADE;


--
-- Name: mata_pelajaran mata_pelajaran_tingkatan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran
    ADD CONSTRAINT mata_pelajaran_tingkatan_id_fkey FOREIGN KEY (tingkatan_id) REFERENCES public.tingkatan(id) ON DELETE CASCADE;


--
-- Name: mudir_tingkatan mudir_tingkatan_tingkatan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mudir_tingkatan
    ADD CONSTRAINT mudir_tingkatan_tingkatan_id_fkey FOREIGN KEY (tingkatan_id) REFERENCES public.tingkatan(id) ON DELETE CASCADE;


--
-- Name: mufatish_tingkatan mufatish_tingkatan_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan
    ADD CONSTRAINT mufatish_tingkatan_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE CASCADE;


--
-- Name: mufatish_tingkatan mufatish_tingkatan_tingkatan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan
    ADD CONSTRAINT mufatish_tingkatan_tingkatan_id_fkey FOREIGN KEY (tingkatan_id) REFERENCES public.tingkatan(id) ON DELETE CASCADE;


--
-- Name: mufatish_tingkatan mufatish_tingkatan_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mufatish_tingkatan
    ADD CONSTRAINT mufatish_tingkatan_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mustahiq_bagian mustahiq_bagian_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian
    ADD CONSTRAINT mustahiq_bagian_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: mustahiq_bagian mustahiq_bagian_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian
    ADD CONSTRAINT mustahiq_bagian_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE CASCADE;


--
-- Name: mustahiq_bagian mustahiq_bagian_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mustahiq_bagian
    ADD CONSTRAINT mustahiq_bagian_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nilai_am nilai_am_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am
    ADD CONSTRAINT nilai_am_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: nilai_am nilai_am_mapel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am
    ADD CONSTRAINT nilai_am_mapel_id_fkey FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: nilai_am nilai_am_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_am
    ADD CONSTRAINT nilai_am_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: nilai_bayan nilai_bayan_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_bayan
    ADD CONSTRAINT nilai_bayan_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: nilai_bayan nilai_bayan_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_bayan
    ADD CONSTRAINT nilai_bayan_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: nilai_khos nilai_khos_mapel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_khos
    ADD CONSTRAINT nilai_khos_mapel_id_fkey FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: nilai_khos nilai_khos_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_khos
    ADD CONSTRAINT nilai_khos_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: nilai_kuartal nilai_kuartal_mapel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_kuartal
    ADD CONSTRAINT nilai_kuartal_mapel_id_fkey FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: nilai_kuartal nilai_kuartal_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai_kuartal
    ADD CONSTRAINT nilai_kuartal_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: pengajar_bagian pengajar_bagian_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar_bagian
    ADD CONSTRAINT pengajar_bagian_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: pengajar_bagian pengajar_bagian_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pengajar_bagian
    ADD CONSTRAINT pengajar_bagian_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE CASCADE;


--
-- Name: penilaian_konfirmasi penilaian_konfirmasi_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi
    ADD CONSTRAINT penilaian_konfirmasi_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: penilaian_konfirmasi penilaian_konfirmasi_pengajar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi
    ADD CONSTRAINT penilaian_konfirmasi_pengajar_id_fkey FOREIGN KEY (pengajar_id) REFERENCES public.pengajar(id) ON DELETE SET NULL;


--
-- Name: penilaian_konfirmasi penilaian_konfirmasi_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_konfirmasi
    ADD CONSTRAINT penilaian_konfirmasi_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: penilaian_status penilaian_status_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_status
    ADD CONSTRAINT penilaian_status_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: penilaian_status penilaian_status_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_status
    ADD CONSTRAINT penilaian_status_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: proses_keluar proses_keluar_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proses_keluar
    ADD CONSTRAINT proses_keluar_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: rekap_absensi rekap_absensi_kuartal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rekap_absensi
    ADD CONSTRAINT rekap_absensi_kuartal_id_fkey FOREIGN KEY (kuartal_id) REFERENCES public.kalender_kuartal(id) ON DELETE CASCADE;


--
-- Name: rekap_absensi rekap_absensi_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rekap_absensi
    ADD CONSTRAINT rekap_absensi_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: riwayat_bagian riwayat_bagian_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riwayat_bagian
    ADD CONSTRAINT riwayat_bagian_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id) ON DELETE CASCADE;


--
-- Name: riwayat_bagian riwayat_bagian_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riwayat_bagian
    ADD CONSTRAINT riwayat_bagian_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: santri santri_bagian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.santri
    ADD CONSTRAINT santri_bagian_id_fkey FOREIGN KEY (bagian_id) REFERENCES public.bagian(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wali_santri_link wali_santri_link_santri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wali_santri_link
    ADD CONSTRAINT wali_santri_link_santri_id_fkey FOREIGN KEY (santri_id) REFERENCES public.santri(id) ON DELETE CASCADE;


--
-- Name: wali_santri_link wali_santri_link_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wali_santri_link
    ADD CONSTRAINT wali_santri_link_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wil_kabupaten wil_kabupaten_provinsi_kode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wil_kabupaten
    ADD CONSTRAINT wil_kabupaten_provinsi_kode_fkey FOREIGN KEY (provinsi_kode) REFERENCES public.wil_provinsi(kode);


--
-- Name: wil_kecamatan wil_kecamatan_kabupaten_kode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wil_kecamatan
    ADD CONSTRAINT wil_kecamatan_kabupaten_kode_fkey FOREIGN KEY (kabupaten_kode) REFERENCES public.wil_kabupaten(kode);


--
-- PostgreSQL database dump complete
--
