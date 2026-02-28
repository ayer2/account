import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Drawer, Button, Dropdown, Avatar, Space } from 'antd'
import {
  HomeOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  BankOutlined,
  TagsOutlined,
  ToolOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores/authStore'

const { Sider, Content } = Layout

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/transactions', icon: <UnorderedListOutlined />, label: '交易' },
    { key: '/statistics', icon: <BarChartOutlined />, label: '统计' },
    { key: '/accounts', icon: <BankOutlined />, label: '账户' },
    ...(user?.role === 'admin' ? [{ key: '/categories', icon: <TagsOutlined />, label: '分类' }] : []),
    { key: '/analysis', icon: <RobotOutlined />, label: 'AI分析' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
    ...(user?.role === 'admin' ? [{ key: '/admin', icon: <ToolOutlined />, label: '管理' }] : []),
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      handleLogout()
    } else {
      navigate(key)
      setMobileMenuOpen(false)
    }
  }

  const userMenuItems = [
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  const siderContent = (
    <>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          flexDirection: 'column',
          padding: '8px 0',
        }}
      >
        <h2 style={{ margin: 0, color: '#1890ff' }}>记账助手</h2>
        <span style={{ fontSize: 12, color: '#999' }}>{user?.email}</span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
      <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
        <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </>
  )

  return (
    <Layout style={{ minHeight: '100vh' }} className="app-layout">
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
        trigger={null}
        width={200}
        className="desktop-sider"
      >
        {siderContent}
      </Sider>

      <Content
        className="main-content"
        style={{
          margin: 16,
          padding: 16,
          background: '#fff',
          borderRadius: 8,
          minHeight: 280,
          overflow: 'auto',
        }}
      >
        <Outlet />
      </Content>

      <div className="mobile-header">
        <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>记账助手</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            type="text" 
            icon={<SettingOutlined />} 
            style={{ fontSize: 18 }} 
            onClick={() => navigate('/settings')}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />} style={{ fontSize: 18 }} />
          </Dropdown>
        </div>
      </div>

      <div className="mobile-bottom-nav">
        <div className="mobile-nav-items">
          {menuItems.slice(0, 5).map(item => (
            <div
              key={item.key}
              className={`mobile-nav-item ${location.pathname === item.key ? 'active' : ''}`}
              onClick={() => handleMenuClick({ key: item.key as string })}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Drawer
        title="记账助手"
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={250}
      >
        <div style={{ marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Avatar icon={<UserOutlined />} />
            <span>{user?.username || user?.email}</span>
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
        <Button
          block
          danger
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          style={{ marginTop: 16 }}
        >
          退出登录
        </Button>
      </Drawer>

      <style>{`
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 100;
        }
        
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #fff;
          border-top: 1px solid #f0f0f0;
          z-index: 100;
          padding-bottom: env(safe-area-inset-bottom);
        }
        
        .mobile-nav-items {
          display: flex;
          justify-content: space-around;
          align-items: center;
          height: 100%;
        }
        
        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          cursor: pointer;
          color: #999;
          transition: color 0.3s;
          padding: 4px 0;
        }
        
        .mobile-nav-item.active {
          color: #1890ff;
        }
        
        .mobile-nav-icon {
          font-size: 20px;
          margin-bottom: 2px;
        }
        
        .mobile-nav-label {
          font-size: 10px;
        }
        
        .desktop-sider {
          display: block !important;
        }
        
        @media (max-width: 768px) {
          .desktop-sider {
            display: none !important;
          }
          .mobile-header {
            display: flex;
          }
          .mobile-bottom-nav {
            display: block;
          }
          .main-content {
            margin: 72px 16px 76px 16px !important;
          }
        }
      `}</style>
    </Layout>
  )
}

export default MainLayout
