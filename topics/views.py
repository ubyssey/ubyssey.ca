from django.shortcuts import render
from django.utils import timezone

# Create your views here.
def cluster_articles_by_topic(considered_articles, items=12, clusters=None, max_in_cluster=3):
    '''
    Cluster articles by their topic. The clustering works by iterating
    from the most recent article and selecting a unique primary or listed topic. These topics are
    then iterated through and recent articles with these topics are joined in a cluster
    '''
        
    # Get the topics of all these articles
    article_topics = [
        {
            "article": article,
            "topics": article.topics.all()
        }
        for article in considered_articles
    ]

    # Iterate through articles and select a topic to represent it
    used_topics = []
    for article_topic in article_topics:
        article = article_topic["article"]

        # Use the primary topic if multiple recent articles are tagged with it
        primary_topic = article.get_primary_topic()
        if primary_topic and not primary_topic in used_topics:
            possible_articles = list(filter(lambda article: primary_topic in article["topics"], 
                                                article_topics))
            if len(possible_articles) > 1:
                used_topics.append(primary_topic)
                continue

        # Get the number of recent articles tagged by topic tagged by this article
        possible_topics = [
            {
                "topic": topic,
                "count": len(list(filter(lambda considered_article: topic in considered_article["topics"], article_topics)))
            }
        for topic in article_topic["topics"]]
        
        # Remove topics that aren't listed or tagged with multiple articles
        possible_topics = list(filter(lambda topic: topic["count"] > 1 and topic["topic"].listed, possible_topics))
        
        # If the there are no listed topics that are tagged with multiple aritcles, then use the primary topic 
        if primary_topic:
            if len(possible_topics) == 0 and not primary_topic in used_topics:
                used_topics.append(primary_topic)
                continue
    
        # Use the first unique listed topic with the lowest number of tagged articles greater than 1  
        possible_topics = sorted(possible_topics, key=lambda topic: topic["count"])
        for topic in possible_topics:
            if not topic["topic"] in used_topics:
                used_topics.append(topic["topic"])
                break

    # Iterate through the collected topics in the order they were added at.
    # We gather the articles under these topics, avoiding articles we have already gathered. 
    seen_articles = []
    cluster = []

    articles_by_topic = {}
    for topic in used_topics:
        articles_by_topic[topic.name] = list(filter(lambda considered_article: topic in considered_article["topics"], article_topics))
        articles_by_topic[topic.name] = list(map(lambda a: a["article"], articles_by_topic[topic.name]))

    while len(used_topics) > 0:
        topic = used_topics[0]
        articles_in_topic = articles_by_topic[topic.name]
        
        cluster_articles = []
        for article in articles_in_topic:
            cluster_articles.append(article)
            seen_articles.append(article)
            if len(seen_articles) >= items or len(cluster_articles) >= max_in_cluster:
                break

        if len(cluster_articles) > 0:
            cluster.append({"topic": topic, "articles": cluster_articles})
        if len(seen_articles) >= items:
            break

        used_topics.pop(0)
        for topic in used_topics:
            articles_by_topic[topic.name] = list(filter(lambda article: not article in seen_articles, articles_by_topic[topic.name]))
        
        used_topics = list(filter(lambda t: len(articles_by_topic[t.name]) > 0, used_topics))
        used_topics = sorted(used_topics, key=lambda t: articles_by_topic[t.name][0].published_at, reverse=True)

    #for clust in cluster:
    #    print(clust["topic"].name)
    #    for article in clust["articles"]:
    #        print(" - " + article.title)
    return cluster