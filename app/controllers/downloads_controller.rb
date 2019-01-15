class DownloadsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_download, only: [:show, :edit, :update, :destroy, :download]

  def index
    @output_files = Download.order(:url).all
    @domain_hash = {}
    @output_files.each do |dl|
      if dl.url
        @domain_hash[dl.url.split('/')[2]] ||= []
        @domain_hash[dl.url.split('/')[2]].push dl.handle
      end
    end
  end

  def new
    @output_file = Download.new
  end

  def create
    post_params = download_params[:download].delete(:post_parameters)
    @output_file = Download.new download_params
    if @output_file.save
      @output_file.process_post_params(post_params)
      redirect_to :action => 'index'
    else
      render :action => 'new'
    end
  end
  
  def update
    myparams = download_params
    post_params = myparams.delete(:post_parameters)
    respond_to do |format|
      if @output_file.update! myparams
        @output_file.process_post_params(post_params)

        format.html { redirect_to( :action => 'index', :notice => 'Download successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @output_file.errors,
                      :status => :unprocessable_entity }
      end
    end
  end

  def destroy
    @output_file.destroy
    redirect_to :action => 'index'
  end
  
  def download
    respond_to do |format|
      begin
        @output_file.download 
        flash[:notice] = 'Download successfully updated.'
        format.html { redirect_to( :action => 'index') }
      rescue Exception => e
        flash[:notice] = "Something went wrong: #{e.message}"
        format.html { redirect_to( :action => 'index') }
      end
    end
  end
  
  def test_url
    @test_url_status = Download.test_url(URI.encode(params[:change_to]))
    render :partial => 'download_test_results'
  end

  def test_save_path
    @test_save_path = Download.test_save_path(params[:change_to])
    render :partial => 'save_location_test_results'
  end
  
  def test_post_params
    @test_post_params = Download.test_post_params(params[:change_to])
    render :partial => 'parameter_formatting_test_results'
  end

  private
  def download_params
    params.require(:download).permit(:handle, :url, :filename_ext, :file_to_extract, :sheet_override, :post_parameters, :notes)
  end

  def set_download
    @output_file = Download.find params[:id]
  end

end
