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
    tags_by_article_id = {}

    for article in considered_articles:
        topics = article.topics.all()
        tags_by_article_id[article.id] =  {
                "article": article,
                "topics": topics
            }

    # Iterate through articles and select a topic to represent it
    used_topics = []
    for article_id in tags_by_article_id.keys():

        article = tags_by_article_id[article_id]["article"]

        # Use the primary topic if multiple recent articles are tagged with it
        primary_topic = article.get_primary_topic()
        if primary_topic and not primary_topic in used_topics:
            possible_articles = list(filter(lambda article_id: primary_topic in tags_by_article_id[article_id]["topics"], 
                                                tags_by_article_id.keys()))
            if len(possible_articles) > 1:
                used_topics.append(primary_topic)
                continue

        # Get the number of recent articles tagged by topic tagged by this article
        possible_topics = [
            {
                "topic": topic,
                "count": len(list(filter(lambda article_id: topic in tags_by_article_id[article_id]["topics"], tags_by_article_id.keys())))
            }
        for topic in tags_by_article_id[article_id]["topics"]]
        
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
        articles_by_topic[topic.name] = list(filter(lambda considered_article_id: topic in tags_by_article_id[considered_article_id]["topics"], tags_by_article_id.keys()))
        articles_by_topic[topic.name] = list(map(lambda article_id: tags_by_article_id[article_id]["article"], articles_by_topic[topic.name]))

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

        if len(cluster_articles) > 1:
            cluster_article_topics = [tags_by_article_id[id]["topics"] for id in [a.id for a in cluster_articles]]
            all_topics = []
            for t in cluster_article_topics:
                all_topics = all_topics + list(t)

            all_topics = set(all_topics)

            shared_topics = list(filter(lambda t: not False in [t in cluster_article_topic for cluster_article_topic in cluster_article_topics], all_topics))

            used_topics = list(filter(lambda t: not t in shared_topics, used_topics))

        used_topics = list(filter(lambda t: len(articles_by_topic[t.name]) > 0, used_topics))
        used_topics = sorted(used_topics, key=lambda t: articles_by_topic[t.name][0].published_at, reverse=True)

    #for clust in cluster:
    #    print(clust["topic"].name)
    #    for article in clust["articles"]:
    #        print(" - " + article.title)
    return cluster