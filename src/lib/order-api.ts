import type { AppMode } from "@/types/custom-tray";

// 这些变量需要在 Vercel/本地的 .env 中配置，或者在部署前端时注入
// NEXT_PUBLIC_API_URL: 您的腾讯云 Edge Function 的地址，例如 https://api.yourdomain.com/orders
// NEXT_PUBLIC_ADMIN_SECRET: 管理员密码，在 Admin 端用来获取数据 (在纯前端项目中暴露管理密码存在风险，但您的 Admin 版本是供自己本地或受保护使用的)

export interface OrderData {
    id: string;
    timestamp: string;
    mode: AppMode;
    params: unknown;
}

/**
 * Public 客户端提交订单
 */
export async function submitOrder(mode: AppMode, params: unknown): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        throw new Error("API URL not configured (NEXT_PUBLIC_API_URL)");
    }

    try {
        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ mode, params }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to submit: ${res.status} ${errorText}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Order submission error:", error);
        throw error;
    }
}

/**
 * Admin 端获取所有订单
 */
export async function fetchOrders(): Promise<OrderData[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;

    if (!apiUrl || !adminSecret) {
        throw new Error("API URL or Admin Secret not configured for fetching orders");
    }

    try {
        const res = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${adminSecret}`,
            },
            // 禁用缓存确保拿到最新订单
            cache: "no-store",
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch orders: ${res.status}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Fetch orders error:", error);
        throw error;
    }
}

/**
 * Admin 端删除订单
 */
export async function deleteOrder(id: string): Promise<{ success: boolean }> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;

    if (!apiUrl || !adminSecret) {
        throw new Error("API URL or Admin Secret not configured for deleting orders");
    }

    try {
        const res = await fetch(`${apiUrl}/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${adminSecret}`,
            },
        });

        if (!res.ok) {
            throw new Error(`Failed to delete order: ${res.status}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Delete order error:", error);
        throw error;
    }
}
