# 腾讯云 EdgeOne Pages (KV 存储) 部署与配置指南

这个指南用于记录如何将 Tray Creator 的订单提交功能（“发送配置至制作者”）部署在纯静态托管环境（如 GitHub Pages / EO Pages）下，并使用腾讯云 EdgeOne (EO) KV 存储作为后端。

## 架构说明
因为静态网页无法运行任何 Node.js 接口代码或保存本地文件，我们采用 EdgeOne KV 存储和 Edge Function（边缘函数）作为轻量无服务器后端。
- **Public 端（客户）**：组合配置参数，通过 `fetch()` 函数将数据以 POST 请求发送至公开的 API 接口，不携带管理员密码，只写不读。
- **Admin 端（制作人）**：在本地开发环境或受保护的单独域名下，请求携带 `Authorization: Bearer <ADMIN_SECRET>` 头部，获得读取和删除所有数据的权限。

---

## 腾讯云 EdgeOne (EO) 配置步骤

如果在未来开通了 KV 存储服务，请按照以下步骤完成部署：

### 第一步：创建 KV 存储 (KV Namespace)
1. 登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)。
2. 进入需要使用的站点。
3. 找到左侧导航栏的 **边缘计算 (Edge Computing)** -> **KV 存储 (KV Store)**。
4. 点击“新建”，创建一个命名空间，名称可以随便起（比如 `TrayOrders`），记住这个空间，后面要绑定。

### 第二步：创建边缘函数 (Edge Function)
1. 在左侧导航栏找到 **边缘计算 (Edge Computing)** -> **边缘函数 (Edge Functions)**。
2. 点击“新建函数”，基础模板选择一个空白 JavaScript 模板。
3. 将我们项目中的 `edge-function-blueprint.js`（由于这是文档，我把代码附在最下方）的全部代码粘贴到代码编辑器中。

### 第三步：配置环境变量与空间绑定
在函数的配置页面（或环境设置页的右侧）：
1. **绑定 KV 命名空间**：
   - 变量名：必须填入 `TRAY_ORDERS`（这是代码中用来调用存储的全局变量）。
   - 绑定刚才第一步创建的 KV 存储节点 `TrayOrders`。
2. **添加环境变量**：
   - 键 (Key)：`ADMIN_SECRET`
   - 值 (Value)：设置一个只有你自己知道的复杂密码，比如 `my-super-secret-password-12345`。这就是防止别人偷看你的订单的保险库钥匙。

### 第四步：部署并配置触发规则
1. 点击保存并部署边缘函数。
2. 在函数页面配置 **触发规则 (Triggers)**。
3. 给这个函数分配一个您站点下的 URL 路径，例如 `api.yourdomain.com/orders*` 或者 `/api/orders*`。
4. 部署成功后，你会得到一个实际可访问的 API 地址。

---

## 前端环境变量配置

有了上面那个 API 地址和您设置的密码之后，在本项目 `tray-creator` 里：

1. 复制 `.env.example` 并重命名为 `.env.local`。
2. 填入相关配置：
```env
# /tray-creator/.env.local
NEXT_PUBLIC_ADMIN_MODE=true
NEXT_PUBLIC_API_URL=https://您的边缘函数网址/api/orders
NEXT_PUBLIC_ADMIN_SECRET=填你在第三步里设置的那个密码
```

完成这些后，重启前端项目 (`pnpm dev`)，然后你就可以在 Public 界面测试“提交订单”，在右上角的“📥 收件箱”里查看订单了。

---

## 附录：Edge Function 后端代码清单
开通后可直接使用这段代码：

```javascript
/**
 * 腾讯云 EdgeOne - 订单 API 函数
 */
export async function handleEvent(event) {
  const request = event.request;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname.endsWith('/orders')) {
    if (request.method === 'POST') {
      return await handlePost(request, corsHeaders);
    } else if (request.method === 'GET') {
      return await handleGet(request, corsHeaders);
    }
  }

  if (request.method === 'DELETE' && url.pathname.includes('/orders/')) {
    const id = url.pathname.split('/').pop();
    return await handleDelete(request, id, corsHeaders);
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

async function handlePost(request, corsHeaders) {
  try {
    const data = await request.json();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const orderData = {
      id: orderId,
      timestamp: new Date().toISOString(),
      mode: data.mode || 'grid',
      params: data.params || {}
    };
    await TRAY_ORDERS.put(orderId, JSON.stringify(orderData));
    return new Response(JSON.stringify({ success: true, id: orderId }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 201
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGet(request, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }
  try {
    const listResult = await TRAY_ORDERS.list();
    const keys = listResult.keys || [];
    const orders = [];
    for (const keyObj of keys) {
      const value = await TRAY_ORDERS.get(keyObj.name);
      if (value) { orders.push(JSON.parse(value)); }
    }
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return new Response(JSON.stringify(orders), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function handleDelete(request, id, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }
  if (!id) return new Response('Missing ID', { status: 400, headers: corsHeaders });
  try {
    await TRAY_ORDERS.delete(id);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleEvent(event));
});
```
