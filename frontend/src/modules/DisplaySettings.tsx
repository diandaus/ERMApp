import React from 'react';
import { Card, Form, Input, Button, message, Tabs, InputNumber, Switch, Upload, Row, Col, Divider, Flex, Space, Typography, Image } from 'antd';
import { SaveOutlined, PictureOutlined, VideoCameraOutlined, SettingOutlined, SoundOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps, TabsProps } from 'antd';

const { TextArea } = Input;
const { Title, Text } = Typography;

type DisplaySettingsType = {
  id?: number;
  nama_rs: string;
  logo_url: string;
  video_url: string;
  running_text_poli: string;
  running_text_apotek: string;
  background_color_poli: string;
  background_color_apotek: string;
  polling_interval: number;
  tts_enabled: boolean;
  tts_rate: number;
  tts_pitch: number;
  tts_volume: number;
};

export const DisplaySettingsView: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [colorPoliPreview, setColorPoliPreview] = React.useState('#1565c0');
  const [colorApotekPreview, setColorApotekPreview] = React.useState('#000000');
  const [logoPreview, setLogoPreview] = React.useState<string>('');
  const [logoUploading, setLogoUploading] = React.useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/display');
      if (res.ok) {
        const data: DisplaySettingsType = await res.json();
        form.setFieldsValue(data);
        setColorPoliPreview(data.background_color_poli || '#1565c0');
        setColorApotekPreview(data.background_color_apotek || '#000000');
        if (data.logo_url) setLogoPreview(data.logo_url);
      } else {
        const defaults = {
          nama_rs: 'PUSKESMAS PIDIE',
          logo_url: '',
          video_url: '',
          running_text_poli: 'SELAMAT DATANG DI RUMAH SAKIT',
          running_text_apotek: 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
          background_color_poli: '#1565c0',
          background_color_apotek: '#000000',
          polling_interval: 3,
          tts_enabled: true,
          tts_rate: 0.85,
          tts_pitch: 1.0,
          tts_volume: 1.0,
        };
        form.setFieldsValue(defaults);
      }
    } catch (error) {
      message.error('Gagal mengambil pengaturan display');
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const onFinish = async (values: DisplaySettingsType) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/display', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success('Pengaturan display berhasil disimpan');
      } else {
        const errorData = await res.json();
        message.error(`Gagal menyimpan: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      message.error('Gagal menyimpan pengaturan display');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/upload',
    accept: 'image/*',
    maxCount: 1,
    showUploadList: false,
    beforeUpload(file) {
      if (!file.type.startsWith('image/')) {
        message.error('Hanya file gambar yang diperbolehkan (JPG, PNG, GIF, dll)');
        return Upload.LIST_IGNORE;
      }
      if (file.size / 1024 / 1024 >= 5) {
        message.error('Ukuran file maksimal 5MB');
        return Upload.LIST_IGNORE;
      }
      setLogoUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      return true;
    },
    onChange(info) {
      if (info.file.status === 'done') {
        setLogoUploading(false);
        const fileUrl = info.file.response?.url || '';
        form.setFieldValue('logo_url', fileUrl);
        setLogoPreview(fileUrl);
        message.success(`${info.file.name} berhasil diupload`);
      } else if (info.file.status === 'error') {
        setLogoUploading(false);
        setLogoPreview('');
        message.error(`${info.file.name} gagal diupload`);
      }
    },
  };

  const videoUploadProps: UploadProps = {
    name: 'file',
    action: '/api/upload',
    accept: 'video/*',
    maxCount: 1,
    showUploadList: false,
    onChange(info) {
      if (info.file.status === 'done') {
        const fileUrl = info.file.response?.url || '';
        form.setFieldValue('video_url', fileUrl);
        message.success(`${info.file.name} berhasil diupload`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} gagal diupload`);
      }
    },
  };

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: <span><SettingOutlined style={{ marginRight: 6 }} />Umum</span>,
      children: (
        <div style={{ padding: '24px 0' }}>
          <Row gutter={[32, 24]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Nama Rumah Sakit / Puskesmas</Text>}
                name="nama_rs"
                rules={[{ required: true, message: 'Nama RS wajib diisi' }]}
              >
                <Input placeholder="Contoh: PUSKESMAS PIDIE" size="large" style={{ fontSize: '15px' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Interval Polling</Text>}
                name="polling_interval"
                help="Seberapa sering display refresh data dari server (dalam detik)"
              >
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber min={1} max={60} size="large" style={{ width: '100%', fontSize: '15px' }} />
                  <Button size="large" disabled style={{ cursor: 'default', color: '#555' }}>detik</Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Divider>
            <PictureOutlined style={{ marginRight: '8px' }} />
            Media Display
          </Divider>

          <Row gutter={[32, 24]}>
            <Col xs={24} md={12}>
              {/* Logo: label dan upload area dikelola manual, logo_url disimpan via hidden Form.Item */}
              <Form.Item label={<Text strong style={{ fontSize: '15px' }}>Logo Rumah Sakit</Text>}>
                <Flex vertical gap={12}>
                  <Upload.Dragger {...uploadProps} style={{ padding: '8px' }} disabled={logoUploading}>
                    {logoPreview ? (
                      <div style={{ padding: '8px' }}>
                        <Image
                          src={logoPreview}
                          alt="Preview Logo"
                          style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                          preview={false}
                        />
                        <div style={{ marginTop: '8px' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>Klik atau drag untuk mengganti logo</Text>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '16px 0' }}>
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                        </p>
                        <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Klik atau drag file logo ke sini</p>
                        <p style={{ fontSize: '12px', color: '#888' }}>JPG, PNG, GIF — Maks 5MB</p>
                      </div>
                    )}
                  </Upload.Dragger>

                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="Atau masukkan URL logo"
                      size="large"
                      style={{ fontSize: '14px' }}
                      value={logoPreview.startsWith('data:') ? '' : logoPreview}
                      onChange={(e) => {
                        setLogoPreview(e.target.value);
                        form.setFieldValue('logo_url', e.target.value);
                      }}
                    />
                    {logoPreview && (
                      <Button
                        size="large"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => {
                          setLogoPreview('');
                          form.setFieldValue('logo_url', '');
                        }}
                        title="Hapus logo"
                      />
                    )}
                  </Space.Compact>

                  <Text type="secondary" style={{ fontSize: '12px' }}>Logo akan ditampilkan di header display antrian</Text>
                </Flex>
              </Form.Item>
              {/* Field tersembunyi untuk menyimpan nilai logo_url ke form */}
              <Form.Item name="logo_url" hidden><Input /></Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Video URL</Text>}
                name="video_url"
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    size="large"
                    style={{ fontSize: '15px' }}
                  />
                  <Upload {...videoUploadProps}>
                    <Button size="large" icon={<VideoCameraOutlined />}>Upload</Button>
                  </Upload>
                </Space.Compact>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '13px' }}>Video/iklan yang ditampilkan (YouTube atau file lokal)</Text>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><PictureOutlined style={{ marginRight: 6 }} />Display Poli</span>,
      children: (
        <div style={{ padding: '24px 0' }}>
          <Row gutter={[32, 24]}>
            <Col xs={24} md={16}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Running Text Poli</Text>}
                name="running_text_poli"
              >
                <TextArea
                  rows={4}
                  placeholder="SELAMAT DATANG DI RUMAH SAKIT - SILAHKAN MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA"
                  style={{ fontSize: '15px' }}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '13px' }}>Teks yang berjalan di bagian bawah display antrian poli</Text>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Warna Background</Text>}
                name="background_color_poli"
                help="Warna background gradient display poli"
              >
                <Flex vertical gap={8}>
                  <Input
                    type="color"
                    size="large"
                    style={{ width: '100%', height: '120px', cursor: 'pointer' }}
                    onChange={(e) => setColorPoliPreview(e.target.value)}
                  />
                  <div style={{
                    padding: '12px',
                    background: colorPoliPreview,
                    color: '#fff',
                    textAlign: 'center',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}>
                    Preview Warna
                  </div>
                  <Input
                    value={colorPoliPreview}
                    size="large"
                    readOnly
                    style={{ textAlign: 'center', fontFamily: 'monospace' }}
                  />
                </Flex>
              </Form.Item>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: '3',
      label: <span><PictureOutlined style={{ marginRight: 6 }} />Display Apotek</span>,
      children: (
        <div style={{ padding: '24px 0' }}>
          <Row gutter={[32, 24]}>
            <Col xs={24} md={16}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Running Text Apotek</Text>}
                name="running_text_apotek"
              >
                <TextArea
                  rows={4}
                  placeholder="HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA - TERIMA KASIH"
                  style={{ fontSize: '15px' }}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '13px' }}>Teks yang berjalan di bagian bawah display antrian apotek</Text>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Warna Background</Text>}
                name="background_color_apotek"
                help="Warna background display apotek"
              >
                <Flex vertical gap={8}>
                  <Input
                    type="color"
                    size="large"
                    style={{ width: '100%', height: '120px', cursor: 'pointer' }}
                    onChange={(e) => setColorApotekPreview(e.target.value)}
                  />
                  <div style={{
                    padding: '12px',
                    background: colorApotekPreview,
                    color: '#fff',
                    textAlign: 'center',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}>
                    Preview Warna
                  </div>
                  <Input
                    value={colorApotekPreview}
                    size="large"
                    readOnly
                    style={{ textAlign: 'center', fontFamily: 'monospace' }}
                  />
                </Flex>
              </Form.Item>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: '4',
      label: <span><SoundOutlined style={{ marginRight: 6 }} />Text-to-Speech</span>,
      children: (
        <div style={{ padding: '24px 0' }}>
          <Row gutter={[32, 24]}>
            <Col xs={24} md={6}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Status TTS</Text>}
                name="tts_enabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '13px' }}>Aktifkan/Nonaktifkan TTS</Text>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Kecepatan Bicara</Text>}
                name="tts_rate"
                help="0.5 = lambat, 1.0 = normal, 2.0 = cepat"
              >
                <InputNumber min={0.5} max={2.0} step={0.05} size="large" style={{ width: '100%', fontSize: '15px' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Nada Suara</Text>}
                name="tts_pitch"
                help="0.5 = rendah, 1.0 = normal, 2.0 = tinggi"
              >
                <InputNumber min={0.5} max={2.0} step={0.05} size="large" style={{ width: '100%', fontSize: '15px' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label={<Text strong style={{ fontSize: '15px' }}>Volume</Text>}
                name="tts_volume"
                help="0.0 = senyap, 1.0 = maksimal"
              >
                <InputNumber min={0.0} max={1.0} step={0.1} size="large" style={{ width: '100%', fontSize: '15px' }} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{
            marginTop: '24px',
            padding: '20px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '8px',
          }}>
            <Text strong style={{ color: '#0050b3', fontSize: '14px' }}>Tips Pengaturan TTS</Text>
            <ul style={{ marginTop: '12px', marginBottom: 0, paddingLeft: '20px', color: '#0050b3' }}>
              <li>Gunakan rate 0.85 untuk kecepatan yang nyaman didengar</li>
              <li>Pitch 1.0 menghasilkan suara yang natural</li>
              <li>Volume 1.0 untuk suara maksimal di area terbuka</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto', background: '#f5f5f5', minHeight: '100vh' }}>
      <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} loading={loading}>
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #f0f0f0' }}>
          <Title level={3} style={{ margin: 0, marginBottom: '8px' }}>
            <SettingOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Pengaturan Display Antrian
          </Title>
          <Text type="secondary">Kelola tampilan display, running text, warna, dan konfigurasi sistem antrian</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Tabs defaultActiveKey="1" size="large" style={{ marginTop: '8px' }} items={tabItems} />

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid #f0f0f0', textAlign: 'center' }}>
            <Space size="middle">
              <Button size="large" onClick={fetchSettings} style={{ paddingLeft: '32px', paddingRight: '32px' }}>
                Reset ke Default
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SaveOutlined />}
                loading={saving}
                style={{ paddingLeft: '48px', paddingRight: '48px', height: '48px', fontSize: '16px', fontWeight: 'bold' }}
              >
                Simpan Pengaturan
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};
