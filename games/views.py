from django.shortcuts import render
from games.models import Crossword


def home(request):
    return render(request, 'games/home.html')

def crosswords(request, id):
    return render(
        request, 
        'games/crossword.html', 
        {
            { "test_data" : Crossword.objects.get(id=id) },
            {"id" : id}
        }
    )
