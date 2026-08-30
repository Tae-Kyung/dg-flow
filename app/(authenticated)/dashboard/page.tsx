import { getCurrentUser } from '@/lib/auth/get-user';
import { USER_ROLES } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">신규 주문</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-gray-500">오늘</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">승인 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-gray-500">건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">총 주문 수량</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-gray-500">이번 달</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">총 면적</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-gray-500">m² 이번 달</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <p>환영합니다, {user?.name}님 ({user ? USER_ROLES[user.role] : ''})</p>
          <p className="text-sm mt-2">주문 데이터가 입력되면 여기에 통계가 표시됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
