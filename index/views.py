from django.shortcuts import render
from django.utils import timezone

from article.models import ArticleTopic, ArticlePage

# Create your views here.

def create_index():
    # Define the span of tagged articles to conisder for the index
    #cutoff = timezone.now() - timezone.timedelta(weeks=52)
    #considered_articles = ArticlePage.objects.filter(explicit_published_at__gte=cutoff)
    considered_articles = ArticlePage.objects.all()

    # Gather all topics used within the tagged article span
    topics_by_articles = [article.topics.all() for article in considered_articles]
    all_topics = []
    for topics_by_article in topics_by_articles:
        all_topics = all_topics + list(topics_by_article)

    # Build the adjacency matrix
    adjacency_matrix = {} 

    for topic in all_topics:
        adjacency_matrix[topic.id] = {}

        for existing_topic in all_topics:
            adjacency_matrix[topic.id][existing_topic.id] = 0

        for topics_by_article in topics_by_articles:
            if topic in topics_by_article:
                for adjacent_topic in topics_by_article:
                    adjacency_matrix[topic.id][adjacent_topic.id] += 1

    # Determine parent-child relationships
    relations = {}
    for topic in adjacency_matrix.keys():
        most_adjacent = None
        adjacency_score = 0
        for existing_topic in adjacency_matrix[topic].keys():
            if topic != existing_topic and adjacency_matrix[topic][topic] < adjacency_matrix[existing_topic][existing_topic]:
                intersection = adjacency_matrix[topic][existing_topic]
                union = adjacency_matrix[existing_topic][existing_topic] - adjacency_matrix[topic][existing_topic] + adjacency_matrix[topic][topic]
                score = intersection/union

                if score > adjacency_score:
                    adjacency_score = score
                    most_adjacent = existing_topic

        if most_adjacent == None or adjacency_score < 0.5:
            relations[topic] = 'root'
        else:
            relations[topic] = most_adjacent

    # Create tree from parent-child relationships
    def build_branch(root, relations):
        children = []
        for topic in relations.keys():
            if relations[topic] == root:
                children.append(build_branch(topic, relations))

        children.sort(key = lambda b: b['topic'].name)

        topic = None
        for t in all_topics:
            if t.id == root:
                topic = t

        return {'topic': topic, 'sub_topics': children}
    
    tree = []
    added_topics = []
    finished = False
    while finished == False:
        finished = True
        for topic in relations.keys():
            if relations[topic] == 'root':
                tree.append(build_branch(topic, relations))

    tree.sort(key = lambda b: b['topic'].name)
    return tree

    