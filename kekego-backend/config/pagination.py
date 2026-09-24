"""Shared API pagination.

Every list endpoint returns a consistent envelope::

    {
      "count": 42,
      "page": 2,
      "page_size": 20,
      "results": [...]
    }

``page`` and ``page_size`` are optional request parameters; ``page_size`` is
capped at ``MAX_PAGE_SIZE`` (100) so clients cannot force huge responses.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPageNumberPagination(PageNumberPagination):
    """Default pagination used by every list endpoint.

    ``page_size_query_param`` enables ``?page_size=``; an unset value falls
    back to ``PAGE_SIZE`` from settings.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    page_query_param = "page"


def paginate(queryset, request, serializer, many=True):
    """Serialize ``queryset`` into the shared pagination envelope."""
    paginator = StandardPageNumberPagination()
    page = paginator.paginate_queryset(queryset, request)
    if page is not None:
        results = serializer(page, many=many).data
        return Response(
            {
                "count": paginator.page.paginator.count,
                "page": paginator.page.number,
                "page_size": paginator.page.paginator.per_page,
                "results": results,
            }
        )
    data = list(queryset)
    results = serializer(data, many=many).data
    return Response(
        {
            "count": len(results),
            "page": 1,
            "page_size": len(results) or 1,
            "results": results,
        }
    )
