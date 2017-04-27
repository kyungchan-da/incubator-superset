const $ = window.$ = require('jquery');

import React from 'react';
import { Button, FormControl, FormGroup, Radio } from 'react-bootstrap';
import { getAjaxErrorMsg, showModal } from '../../modules/utils';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  css: React.PropTypes.string,
  dashboard: React.PropTypes.object.isRequired,
  triggerNode: React.PropTypes.node.isRequired,
  slice: React.PropTypes.object,
  isButton: React.PropTypes.bool,
  isLink: React.PropTypes.bool,
};

class ExportMailModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboard: props.dashboard,
      css: props.css,
      target: '',
      screenWidth: 1600,
      working: false
    };
    this.modal = null;
    this.handleTargetChange = this.handleTargetChange.bind(this);
    this.handleScreenWidthChange = this.handleScreenWidthChange.bind(this);
    this.exportEmail = this.exportEmail.bind(this);
  }
  handleTargetChange(event) {
    this.setState({
      target: event.target.value,
    });
  }
  handleScreenWidthChange(event) {
    this.setState({
      screenWidth: event.target.value,
    });
  }
  isEmail(emailList) {
    var i, emails = emailList.split(','), re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (emails.length == 0) {
      return false;
    }
    for (i = 0; i < emails.length; i++) {
      if (!(re.test(emails[i].trim()))) {
        return false;
      }
    }
    return true;
  }
  exportEmail(target, screenWidth, exportType) {
    const dashboard = this.props.dashboard;
    const exportMailModal = this.modal;
    const slice = this.props.slice;
    const $this = this;
    var data = {
      target: target,
      screenwidth: screenWidth || 1600,
      "dashbaord_name": dashboard.dashboard_title,
      selector: slice ? '#slice_' + slice.slice_id : false,
    };
    if (exportType === 'email' && !this.isEmail(target)) {
      exportMailModal.close();
      showModal({
        title: 'Invalid email',
        body: 'Please enter valid email address',
      });
      return;
    }
    this.setState({working: true});
    $.ajax({
      type: 'POST',
      url: '/superset/export/dashboard/' + (dashboard.slug || dashboard.id) + '/' + exportType,
      data: data,
      success(resp) {
        $this.setState({working: false});
        exportMailModal.close();
        if(exportType === 'download') {
          showModal({
            title: 'Success',
            body: 'The download of snapshot should be started immediately.',
          });
          var filename = slice ? "Lumos-Dashboard-"+dashboard.id+"-slice-"+slice.slice_id+".jpeg" : "Lumos-Dashboard-"+dashboard.id+".jpg", a = document.createElement('a');
          a.setAttribute("download", filename);
          a.setAttribute("href", 'data:image/jpeg;base64,' + resp.image);
          a.click();
        }
        else if(exportType === 'email') {
          showModal({
            title: 'Success',
            body: 'The snapshot of dashboard was sent to '+target+' successfully.',
          });
        }
      },
      error(error) {
        $this.setState({working: false});
        exportMailModal.close();
        const errorMsg = getAjaxErrorMsg(error);
        showModal({
          title: 'Error',
          body: 'Sorry, there was an error exporting this dashboard: </ br>' + errorMsg,
        });
      },
    });
  }
  render() {
    let sliceFormControl = null, working = this.state.working;
    if(this.props.slice) {
      sliceFormControl = (<FormControl
        type="text"
        disabled
        defaultValue={this.props.slice.slice_name}
      />)
    }
    let loadingElement = null;
    if(working) {
      loadingElement = (<i className="fa fa-spinner fa-spin fa-fw"></i>)
    }
    return (
      <ModalTrigger
        ref={(modal) => { this.modal = modal; }}
        triggerNode={this.props.triggerNode}
        isButton={this.props.isButton}
        tooltip="Export"
        isLink={this.props.isLink}
        modalTitle="Export Snapshot as image"
        modalBody={
          <FormGroup>
            { sliceFormControl }
            Recipient emails (applicable to email export)
            <FormControl
              type="text"
              placeholder="Recepient emails, separated by comma(,)"
              onFocus={this.handleTargetChange}
              onChange={this.handleTargetChange}
            />
            Snapshot width(Screen width)
            <FormControl
              type="number"
              placeholder="Leave blank for default 1600px"
              onFocus={this.handleScreenWidthChange}
              onChange={this.handleScreenWidthChange}
            />
          </FormGroup>
        }
        modalFooter={
          <div>
            {loadingElement}
            <Button
              bsStyle="primary"
              onClick={() => { this.exportEmail(this.state.target, this.state.screenWidth, 'email'); }}
              disabled={working}
            >
              <i className="fa fa-envelope" aria-hidden="true"></i> Send to email
            </Button>
            <Button
              bsStyle="primary"
              onClick={() => { this.exportEmail(this.state.target, this.state.screenWidth, 'download'); }}
              disabled={working}
            >
              <i className="fa fa-download" aria-hidden="true"></i> Download to local
            </Button>
          </div>
        }
      />
    );
  }
}
ExportMailModal.propTypes = propTypes;

export default ExportMailModal;
