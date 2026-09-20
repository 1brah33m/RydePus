from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsDriver
from apps.users.serializers import UserSerializer


class DriverMeView(APIView):
    """GET /api/v1/drivers/me/ - driver-only endpoint.

    Demonstrates role-based access control: a student calling this endpoint
    receives HTTP 403. Will later serve the driver's own profile data.
    """

    permission_classes = [IsDriver]

    def get(self, request):
        return Response(UserSerializer(request.user).data)