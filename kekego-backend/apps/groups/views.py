from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsStudent


class StudentOnlyPingView(APIView):
    """GET /api/v1/groups/ping/ - student-only endpoint.

    Proves role-based access control: drivers calling this endpoint receive
    HTTP 403. Group listing/creation logic arrives in a later stage.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        return Response(
            {"message": "Student-only endpoint works.", "role": request.user.role}
        )