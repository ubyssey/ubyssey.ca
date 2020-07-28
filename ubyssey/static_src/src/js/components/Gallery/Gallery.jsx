import React from 'react';
// import createReactClass from 'create-react-class';
import {findDOMNode} from 'react-dom';
import GallerySlide from './GallerySlide.jsx';
import LinkedList from '../../modules/LinkedList';
import Hammer from 'hammerjs';
import key from 'keymaster';

class Gallery extends React.Component{
    constructor(props) {
        super(props);
        this.state = ({
            active: null,
            index: false,
            image: false,
            visible: false,
            deltax: 0,
            slideWidth: $(window).width()
        })
    }

    componentDidMount() {
        this.images = new LinkedList(this.props.images);
        this.setupEventListeners();
        this.addSlideTrigger(this.props.trigger);
        this.initSlider();
    }

    initSlider = () => {

        var element = findDOMNode(this.refs.gallery);

        this.element = $(element);

        this.container = $("ul.slides", this.element);

        this.panes = $("li.slide", this.element);

        this.paneWidth = $(window).width();
        this.paneCount = this.props.images.length;

        this.currentPane = 0;

        this.slideCallback = this.next;

        this.setPaneDimensions();

        $(window).on("load resize orientationchange", () => {
            this.setPaneDimensions();
            this.setState({ slideWidth: $(window).width() });
        });

        if (this.paneCount > 1){

            var mc = new Hammer.Manager(element, { drag_lock_to_axis: true } );

            mc.add( new Hammer.Pan( { threshold: 0, direction: Hammer.DIRECTION_HORIZONTAL }) );
            mc.add( new Hammer.Swipe( { threshold: 1 }) ).recognizeWith( mc.get('pan') );

            mc.on("panend pancancel panleft panright swipeleft swiperight", (e) => this.handleHammer(e));

            /* From Modernizr */
            const whichTransitionEvent = () => {
                var t;
                var el = document.createElement('fakeelement');
                var transitions = {
                  'transition':'transitionend',
                  'OTransition':'oTransitionEnd',
                  'MozTransition':'transitionend',
                  'WebkitTransition':'webkitTransitionEnd'
                }

                for (t in transitions){
                    if ( el.style[t] !== undefined ){
                        return transitions[t];
                    }
                }
            }

            /* Listen for a transition! */
            var transitionEvent = whichTransitionEvent();
            transitionEvent && element.addEventListener(transitionEvent, function() {
                //this.slideCallback();
            });
        }

    }

    setPaneDimensions = () => {
        this.paneWidth = $(window).width();
        this.container.width(this.paneWidth*this.paneCount + this.paneCount*15);
    }

    updatePaneDimensions = () => {
        this.container = $("ul.slides", this.element);

        this.panes = $("li.slide", this.element);

        this.paneCount = this.props.images.length;

        this.setPaneDimensions();

        // reset current pane
        this.showPane(this.currentPane, false);
    }

    showPane = (index, animate) => {
        // between the bounds
        index = Math.max(0, Math.min(index, this.paneCount-1));

        this.currentPane = index;

        var offset = -((100/this.paneCount)*this.currentPane);

        this.setContainerOffset(offset, true);
    }

    setContainerOffset = (percent, animate) => {
        this.container.toggleClass('animate', animate);
        this.container.css('transform', `translate3d(${percent}%,0,0) scale3d(1,1,1)`);

    }

    nextSlide = () => {
        if (this.state.active && this.state.active.next)
            this.setState({ active: this.state.active.next});
        return this.showPane(this.currentPane + 1, true);
    }

    prevSlide = () => {
        if (this.state.active && this.state.active.prev)
            this.setState({ active: this.state.active.prev});
        return this.showPane(this.currentPane - 1, true);
    }

    handleHammer = (ev) => {

        // disable browser scrolling
        //ev.preventDefault();

        switch(ev.type) {
            case 'panright':
            case 'panleft':
                // stick to the finger
                var pane_offset = -(100/this.paneCount) * this.currentPane;
                var drag_offset = ((100/this.paneWidth) * ev.deltaX) / this.paneCount;

                // slow down at the first and last pane
                if ((this.currentPane == 0  && ev.direction == Hammer.DIRECTION_RIGHT) ||
                   (this.currentPane == this.paneCount-1 && ev.direction == Hammer.DIRECTION_LEFT)) {
                  drag_offset *= .4;
                }

                this.setContainerOffset(drag_offset + pane_offset);
                break;

            case 'panend':
            case 'pancancel':
                //Left & Right
                //less then 2/3 moved, don't register swipe
                if (Math.abs(ev.deltaX) < (this.paneWidth * 2/3)) {
                  this.showPane(this.currentPane, true);
                }

                break;

            case 'swipeleft':
                this.nextSlide();
                break;

            case 'swiperight':
                this.prevSlide();
                break;

        }
    }

    setupEventListeners = () => {

        // Keyboard controls
        key('left', () => this.prevSlide());
        key('right', () => this.nextSlide());
        key('esc', () => this.close());

        // Arrow buttons
        $(document).on('click', '.prev-slide', e => {
            e.preventDefault();
            this.previous();
        });

        $(document).on('click', '.next-slide', e => {
            e.preventDefault();
            this.next();
        });
    }

    addSlideTrigger = (target) => {
        $(target).on('click', e => {
            e.preventDefault();
            const imageId = $(e.target).data('id');

            if (this.state.visible){
                this.close();
            } else {
                this.open(imageId);
            }
        });
    }

    setIndex = (index) => {
        const {url, caption} = this.props.images[index];
        this.setState({
            index,
            caption,
            image: url,
        });
    }

    getImage = (imageId) => {
        const index = this.props.imagesTable[imageId];
        return this.props.images[index];
    }

    getActiveImage = (imageId) => {
        let active = this.images;
        while(active){
            if (active.data.id == imageId)
                return active;
            active = active.next;
        }
        return null;
    }

    getIndex = (imageId, images) => {
        for (let i = 0; i < images.length; i++) {
            if (images[i].id == imageId)
                return i;
        }
        return -1;
    }

    setCurrentImage = (imageId) => {
        this.showPane(this.getIndex(imageId, this.props.images));
        this.setState({ active: this.getActiveImage(imageId)}, () => this.updatePaneDimensions());
    }

    open = (imageId) => {
        this.setCurrentImage(imageId);
        this.setState({ visible: true });
        $('body').addClass('no-scroll');
    }

    close = () => {
        this.setState({ visible: false });
        $('body').removeClass('no-scroll');
    }

    previous = () => {
        if (!this.state.active || !this.state.active.prev)
            return
        this.setState({ active: this.state.active.prev });
    }

    next = () => {
        if (!this.state.active || !this.state.active.next)
            return
        this.setState({ active: this.state.active.next });
    }

    renderImage = () => {
        if (this.state.image){
            var imageStyle = { maxHeight: $(window).height() - 200 };
            return (
                <div className="slide">
                    <img className="slide-image" style={imageStyle} src={this.state.image} alt=""/>
                    <p className="slide-caption">{this.state.caption}</p>
                    {this.renderControls()}
                </div>
            );
        }
    }

    renderControls = () => {
        if (this.props.images.length > 1){
            return (
                <div className="navigation">
                    <a className="prev-slide" href="#"><i className="fa fa-chevron-left"></i></a>
                    <span className="curr-slide">{this.state.index + 1}</span> &nbsp;of&nbsp; <span className="total-slide">{this.props.images.length}</span>
                    <a className="next-slide" href="#"><i className="fa fa-chevron-right"></i></a>
                </div>
            );
        }
    }

    render() {
        const visible = this.state.visible ? 'visible' : '';

        const slides = this.props.images.map((image, i) => (
            <GallerySlide key={i} index={i} width={this.state.slideWidth} src={image.url} caption={image.caption} credit={image.credit} />
        ));

        const prev = (<div onClick={() => this.prevSlide()} className="prev"><div><i className="fa fa-chevron-left"></i></div></div>);
        const next = (<div onClick={() => this.nextSlide()} className="next"><div><i className="fa fa-chevron-right"></i></div></div>);

        return (
            <div className={'slideshow ' + visible}>
                <div className="image-container" ref="gallery">
                    <div onClick={() => this.close()} className="close-slideshow"><i className="fa fa-times"></i></div>
                    <div className="gallery-container">
                        <ul className="slides" ref="slides">{slides}</ul>
                    </div>
                    { this.state.active && this.state.active.prev ? prev : null }
                    { this.state.active && this.state.active.next ? next : null }
                </div>
            </div>
        );
    }
}

export default Gallery;
